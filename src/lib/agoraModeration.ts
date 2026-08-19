import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Shared building blocks for Agora's moderation labels (NIP-32 kind 1985 in
 * the `agora.moderation` namespace). Campaigns (kind 33863), organizations
 * (kind 34550), and pledges (kind 36639) all ride the same label stream and
 * the same moderator pack (Team Soapbox); the only thing that varies
 * between them is the kind prefix on the `a` tag.
 *
 * Centralizing the constants, types, and folding logic here keeps the
 * per-surface hooks (`useCampaignModeration`, `useOrganizationModeration`,
 * `usePledgeModeration`) from drifting apart on namespace strings, axis
 * semantics, or the surfacing-rule contract documented in NIP.md.
 *
 * Two axes are defined: `hide` (universal) and `featured` (universal).
 * The approval axis was removed once Featured became the single positive
 * curation mechanism on the home page — see NIP.md and the project
 * changelog for the history.
 */

/** NIP-32 label kind. */
export const LABEL_KIND = 1985;

/** Label namespace for Agora's moderation labels. */
export const AGORA_MODERATION_NAMESPACE = 'agora.moderation';

/** The four possible label values in the moderation namespace. */
export type ModerationLabel =
  | 'hidden'
  | 'unhidden'
  | 'featured'
  | 'unfeatured';

/** A single label event narrowed to its decision axis. */
interface AxisDecision {
  /** Latest label observed on this axis. */
  label: ModerationLabel;
  /** Author of the latest label. */
  pubkey: string;
  /** Created-at of the latest label. */
  createdAt: number;
  /**
   * Optional explicit rank from a `["rank", "<number>"]` tag on the
   * event. Reorder operations publish this so the sort key is
   * independent of `created_at` — the fold's "newest event per
   * (coord, axis)" rule would otherwise reject a label that
   * attempts to move a campaign downward (lower `created_at` than
   * the current label).
   *
   * `undefined` for labels published before the reorder feature
   * shipped, or for normal hide / feature actions that don't carry
   * a rank. Callers compute an effective sort key with
   * `rank ?? createdAt`, giving legacy labels a sensible default
   * while letting reorder labels override.
   */
  rank?: number;
}

/** Per-coordinate rollup of hide + featured state. */
export interface ModerationState {
  hide?: AxisDecision; // `hidden` or `unhidden`
  featured?: AxisDecision; // `featured` or `unfeatured`
}

/**
 * Per-surface rollup. Keys are the addressable coordinates we filtered for
 * (e.g. `33863:<pubkey>:<d>` for campaigns or `34550:<pubkey>:<d>` for
 * organizations).
 */
export interface ModerationData {
  /** Map of `<kind>:<pubkey>:<d>` -> rollup. */
  byCoord: Map<string, ModerationState>;
  /** Coordinates where the latest hide label is `hidden`. */
  hiddenCoords: Set<string>;
  /** Coordinates where the latest featured label is `featured`. */
  featuredCoords: Set<string>;
  /**
   * Map of `coord` -> sort key for the featured row, descending.
   *
   * The value is the rank carried by the latest `featured` label's
   * `["rank", "<number>"]` tag, falling back to the label's
   * `created_at` when no rank tag is present. Moderators reorder
   * featured campaigns by republishing the `featured` label with a
   * chosen rank (see `useReorderCampaign`); the fold always picks
   * the newest-`created_at` label per `(coord, axis)`, so reorder
   * publishes carry both a fresh `created_at = now` AND an explicit
   * rank that controls the sort.
   *
   * The fallback to `created_at` makes legacy labels (published
   * before the rank tag existed) sort sensibly — newer features
   * float to the top, exactly as before the rank tag landed.
   */
  featuredOrder: Map<string, number>;
  /** Pubkeys that were considered moderators when the query ran. */
  moderators: string[];
}

export const EMPTY_MODERATION_DATA: ModerationData = {
  byCoord: new Map(),
  hiddenCoords: new Set(),
  featuredCoords: new Set(),
  featuredOrder: new Map(),
  moderators: [],
};

function isHideLabel(value: string): value is 'hidden' | 'unhidden' {
  return value === 'hidden' || value === 'unhidden';
}

function isFeaturedLabel(value: string): value is 'featured' | 'unfeatured' {
  return value === 'featured' || value === 'unfeatured';
}

/**
 * Extract the rank value from a `["rank", "<number>"]` tag if present,
 * otherwise `undefined`. The value is parsed as a finite Number — a
 * non-numeric rank tag is treated as if it wasn't there so callers can
 * fall back to `created_at` cleanly.
 */
function extractRank(event: NostrEvent): number | undefined {
  const tag = event.tags.find(([n]) => n === 'rank');
  if (!tag) return undefined;
  const raw = tag[1];
  if (typeof raw !== 'string') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Fold a flat list of label events into per-coordinate rollups by axis.
 * The newest event per `(coord, axis)` wins.
 *
 * Events are filtered to only those carrying an `a` tag that starts with
 * `<coordKind>:` so the campaign and organization label streams never bleed
 * into each other even though they share a namespace and signer set.
 *
 * Events with a value outside the moderation namespace, or with no `l` tag
 * in that namespace, are dropped. Legacy `approved` / `unapproved` labels
 * (from the previous approval axis) are silently ignored — the axis was
 * retired in favor of Featured-only positive curation.
 */
export function foldModerationLabels(
  events: NostrEvent[],
  moderators: string[],
  coordKind: number,
): ModerationData {
  const coordPrefix = `${coordKind}:`;
  const byCoord = new Map<string, ModerationState>();

  for (const event of events) {
    const value = event.tags.find(
      ([n, , ns]) => n === 'l' && ns === AGORA_MODERATION_NAMESPACE,
    )?.[1];
    if (!value) continue;
    const aTag = event.tags.find(
      ([n, v]) => n === 'a' && typeof v === 'string' && v.startsWith(coordPrefix),
    )?.[1];
    if (!aTag) continue;

    const rank = extractRank(event);
    const state = byCoord.get(aTag) ?? {};
    if (isHideLabel(value)) {
      if (!state.hide || event.created_at > state.hide.createdAt) {
        state.hide = { label: value, pubkey: event.pubkey, createdAt: event.created_at, rank };
      }
    } else if (isFeaturedLabel(value)) {
      if (!state.featured || event.created_at > state.featured.createdAt) {
        state.featured = { label: value, pubkey: event.pubkey, createdAt: event.created_at, rank };
      }
    }
    // Unknown values (including legacy `approved`/`unapproved`) drop out
    // silently. The approval axis is retired; clients that still see
    // such labels in their cache simply ignore them.
    byCoord.set(aTag, state);
  }

  const hiddenCoords = new Set<string>();
  const featuredCoords = new Set<string>();
  const featuredOrder = new Map<string, number>();
  for (const [coord, state] of byCoord) {
    if (state.hide?.label === 'hidden') hiddenCoords.add(coord);
    if (state.featured?.label === 'featured') {
      featuredCoords.add(coord);
      // Effective sort key: explicit rank tag wins, falling back to
      // the label's created_at so labels published before the rank
      // tag existed still sort correctly (newest-featured first).
      featuredOrder.set(coord, state.featured.rank ?? state.featured.createdAt);
    }
  }

  return { byCoord, hiddenCoords, featuredCoords, featuredOrder, moderators };
}

/**
 * Per-event rollup, for moderating **regular** (non-addressable) events.
 *
 * Structurally identical to {@link ModerationData}, but keyed by event id
 * rather than by `<kind>:<pubkey>:<d>` coordinate. Kept as a separate type so
 * the two key spaces can never be mixed up at a call site — an event id and a
 * coordinate are both strings, and swapping them would silently produce an
 * empty rollup (i.e. fail open, showing content a moderator hid).
 */
export interface EventModerationData {
  /** Map of event id -> rollup. */
  byId: Map<string, ModerationState>;
  /** Event ids where the latest hide label is `hidden`. */
  hiddenIds: Set<string>;
  /** Event ids where the latest featured label is `featured`. */
  featuredIds: Set<string>;
  /** Map of event id -> sort key for the featured/pinned row, descending. */
  featuredOrder: Map<string, number>;
  /** Pubkeys that were considered moderators when the query ran. */
  moderators: string[];
}

export const EMPTY_EVENT_MODERATION_DATA: EventModerationData = {
  byId: new Map(),
  hiddenIds: new Set(),
  featuredIds: new Set(),
  featuredOrder: new Map(),
  moderators: [],
};

/**
 * Fold label events targeting regular events (via `e` tags) into per-event
 * rollups by axis. The newest event per `(id, axis)` wins.
 *
 * Used by the in-app issue tracker on `/issues`, where the moderated entities
 * are kind 1621 issues — regular events that anyone may publish against
 * Agora's repository coordinate. Hiding is the defense against a stranger
 * publishing abuse into a list the app renders to every user.
 *
 * Unlike {@link foldModerationLabels}, there is no kind prefix available on an
 * `e` tag to scope one label stream from another, so **callers MUST scope the
 * query relay-side** with `'#e': [...knownIds]` — passing only ids they
 * already fetched for this surface. That is strictly tighter than a prefix
 * check, since an unrelated label can't name an id we didn't ask for.
 *
 * The moderator author match is enforced here as well as in the query filter.
 * The relay-side `authors:` filter is the real gate, but a cached or merged
 * event that bypassed it must not be able to hide or feature anything.
 */
export function foldEventModerationLabels(
  events: NostrEvent[],
  moderators: string[],
): EventModerationData {
  const trusted = new Set(moderators);
  const byId = new Map<string, ModerationState>();

  for (const event of events) {
    if (!trusted.has(event.pubkey)) continue;

    const value = event.tags.find(
      ([n, , ns]) => n === 'l' && ns === AGORA_MODERATION_NAMESPACE,
    )?.[1];
    if (!value) continue;
    const target = event.tags.find(
      ([n, v]) => n === 'e' && typeof v === 'string' && v.length === 64,
    )?.[1];
    if (!target) continue;

    const rank = extractRank(event);
    const state = byId.get(target) ?? {};
    if (isHideLabel(value)) {
      if (!state.hide || event.created_at > state.hide.createdAt) {
        state.hide = { label: value, pubkey: event.pubkey, createdAt: event.created_at, rank };
      }
    } else if (isFeaturedLabel(value)) {
      if (!state.featured || event.created_at > state.featured.createdAt) {
        state.featured = { label: value, pubkey: event.pubkey, createdAt: event.created_at, rank };
      }
    }
    byId.set(target, state);
  }

  const hiddenIds = new Set<string>();
  const featuredIds = new Set<string>();
  const featuredOrder = new Map<string, number>();
  for (const [id, state] of byId) {
    if (state.hide?.label === 'hidden') hiddenIds.add(id);
    if (state.featured?.label === 'featured') {
      featuredIds.add(id);
      featuredOrder.set(id, state.featured.rank ?? state.featured.createdAt);
    }
  }

  return { byId, hiddenIds, featuredIds, featuredOrder, moderators };
}
