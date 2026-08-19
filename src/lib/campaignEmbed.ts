/**
 * Shared contract between the embeddable campaign widget route
 * (`/embed/campaign/:nip19`) and the builder dialog that generates its
 * `<iframe>` snippet.
 *
 * Both sides read the same types and helpers so a snippet the builder emits
 * always resolves to the widget the embedder previewed. Everything a real
 * embedder needs is encoded in the URL; the `postMessage` protocol below is
 * an optimization for the builder's own preview, never a requirement.
 */

/**
 * Which widget the embedder gets.
 *
 * - `card` — the click-through {@link CampaignCard}. No payment affordances;
 *   clicking opens the campaign on Agora in a new tab. This is the original
 *   (and therefore default) widget, so snippets pasted before variants
 *   existed keep rendering exactly what they did before.
 * - `donate` — pay-only: QR, copyable BIP-21 URI, external-wallet hand-off,
 *   and the campaign's card link when it declares one. Carries just enough
 *   campaign identity (title, raised) that a donor is never scanning an
 *   unlabeled address.
 * - `full` — `card`'s banner/title/progress *plus* `donate`'s payment stack,
 *   for embedders who want the whole campaign on their page.
 */
export type CampaignEmbedVariant = 'card' | 'donate' | 'full';

/**
 * Color scheme for the widget.
 *
 * A widget can't read its host page's theme, and inside a cross-origin iframe
 * the app's stored preference lives in the *partner's* partitioned storage —
 * so the embedder picks explicitly. `auto` follows the visitor's
 * `prefers-color-scheme`.
 */
export type CampaignEmbedTheme = 'auto' | 'light' | 'dark';

export const CAMPAIGN_EMBED_VARIANTS: readonly CampaignEmbedVariant[] = [
  'card',
  'donate',
  'full',
] as const;

export const CAMPAIGN_EMBED_THEMES: readonly CampaignEmbedTheme[] = [
  'auto',
  'light',
  'dark',
] as const;

export const DEFAULT_CAMPAIGN_EMBED_VARIANT: CampaignEmbedVariant = 'card';
export const DEFAULT_CAMPAIGN_EMBED_THEME: CampaignEmbedTheme = 'auto';

/**
 * Message posted to the parent window whenever the widget's content height
 * changes, so a host-side loader can size the iframe to fit. The builder
 * dialog listens for this to auto-size its own live preview.
 */
export const CAMPAIGN_EMBED_HEIGHT_MESSAGE = 'agora:embed:height';

/** Shape of the {@link CAMPAIGN_EMBED_HEIGHT_MESSAGE} payload. */
export interface CampaignEmbedHeightMessage {
  type: typeof CAMPAIGN_EMBED_HEIGHT_MESSAGE;
  height: number;
}

/**
 * Narrows an untrusted `postMessage` payload to a height message. Callers
 * must still verify `event.origin` — this only validates the shape.
 */
export function isCampaignEmbedHeightMessage(
  data: unknown,
): data is CampaignEmbedHeightMessage {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as Record<string, unknown>;
  return (
    message.type === CAMPAIGN_EMBED_HEIGHT_MESSAGE &&
    typeof message.height === 'number' &&
    Number.isFinite(message.height)
  );
}

/**
 * Message posted to the parent window once the widget has mounted and is
 * listening for {@link CAMPAIGN_EMBED_CONFIG_MESSAGE}.
 *
 * Without it the builder would have to guess when the frame is ready: a
 * config posted while the app inside is still booting lands on a window with
 * no listener and is silently dropped, so a variant clicked during the first
 * second would appear to do nothing. The frame announces itself instead, and
 * the builder replies with whatever is currently selected.
 */
export const CAMPAIGN_EMBED_READY_MESSAGE = 'agora:embed:ready';

/**
 * Message posted *into* the widget to change what it renders without
 * reloading it.
 *
 * Changing the iframe's `src` reboots the entire app inside it — bundle
 * parse, relay connections, campaign fetch, on-chain balance lookup — which
 * made flipping between variants in the builder cost a full cold start each
 * time. The widget applies these in place instead, reusing the already-warm
 * query cache and relay pool, so switching is a re-render.
 *
 * This is strictly a builder-side convenience: the widget only accepts these
 * from a same-origin parent, and a real third-party embed configures itself
 * through the URL. Snippets stay declarative and copy-pasteable.
 */
export const CAMPAIGN_EMBED_CONFIG_MESSAGE = 'agora:embed:config';

/** Shape of the {@link CAMPAIGN_EMBED_CONFIG_MESSAGE} payload. */
export interface CampaignEmbedConfigMessage {
  type: typeof CAMPAIGN_EMBED_CONFIG_MESSAGE;
  variant: CampaignEmbedVariant;
  theme: CampaignEmbedTheme;
}

/** Narrows an untrusted `postMessage` payload to a ready signal. */
export function isCampaignEmbedReadyMessage(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === CAMPAIGN_EMBED_READY_MESSAGE
  );
}

/**
 * Narrows an untrusted `postMessage` payload to a config message. Callers
 * must still verify `event.origin` — this only validates the shape.
 *
 * Unknown variants and themes are rejected rather than coerced to defaults:
 * a message is a live command from a caller that should know the vocabulary,
 * unlike a hand-edited URL, where degrading gracefully is the point.
 */
export function isCampaignEmbedConfigMessage(
  data: unknown,
): data is CampaignEmbedConfigMessage {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as Record<string, unknown>;
  return (
    message.type === CAMPAIGN_EMBED_CONFIG_MESSAGE &&
    CAMPAIGN_EMBED_VARIANTS.includes(message.variant as CampaignEmbedVariant) &&
    CAMPAIGN_EMBED_THEMES.includes(message.theme as CampaignEmbedTheme)
  );
}

/**
 * Intrinsic width and starting height of each widget, in CSS pixels.
 *
 * `width` is a genuine max-width — the snippet pins it so the widget never
 * stretches to a full-bleed column on a wide host page, and the QR/CTA stack
 * has a layout it was designed for.
 *
 * `height` is only the *initial* iframe height. An iframe can't grow to fit
 * its content on its own, so this has to be a static number generous enough
 * to avoid an inner scrollbar before any host-side auto-sizing kicks in.
 */
export const CAMPAIGN_EMBED_SIZES: Record<
  CampaignEmbedVariant,
  { width: number; height: number }
> = {
  card: { width: 420, height: 560 },
  donate: { width: 380, height: 660 },
  full: { width: 420, height: 900 },
};

/** Coerces an untrusted query value to a known variant. */
export function parseCampaignEmbedVariant(
  value: string | null | undefined,
): CampaignEmbedVariant {
  return CAMPAIGN_EMBED_VARIANTS.includes(value as CampaignEmbedVariant)
    ? (value as CampaignEmbedVariant)
    : DEFAULT_CAMPAIGN_EMBED_VARIANT;
}

/** Coerces an untrusted query value to a known theme. */
export function parseCampaignEmbedTheme(
  value: string | null | undefined,
): CampaignEmbedTheme {
  return CAMPAIGN_EMBED_THEMES.includes(value as CampaignEmbedTheme)
    ? (value as CampaignEmbedTheme)
    : DEFAULT_CAMPAIGN_EMBED_THEME;
}

interface CampaignEmbedOptions {
  /** Campaign `naddr1…` identifier. */
  naddr: string;
  variant: CampaignEmbedVariant;
  theme: CampaignEmbedTheme;
  /** Absolute origin to build against, e.g. `https://agora.example`. */
  origin: string;
}

/**
 * Builds the absolute widget URL. `variant` and `theme` are always written
 * out, even at their defaults, so an embedder reading their own snippet can
 * see (and hand-edit) what they chose.
 */
export function buildCampaignEmbedUrl({
  naddr,
  variant,
  theme,
  origin,
}: CampaignEmbedOptions): string {
  const url = new URL(`/embed/campaign/${naddr}`, origin);
  url.searchParams.set('variant', variant);
  url.searchParams.set('theme', theme);
  return url.toString();
}

/**
 * Builds the ready-to-paste `<iframe>` snippet.
 *
 * Two attributes are load-bearing and easy to lose in a hand-edit:
 *
 * - `allow="clipboard-write"` — the Permissions Policy for clipboard access
 *   defaults to `self`, so without this the widget's "copy payment URI"
 *   button fails in every cross-origin embed.
 * - `referrerpolicy="no-referrer-when-downgrade"` — matches the browser
 *   default explicitly rather than leaving it to the host page's policy.
 *
 * @param title Localized `title` attribute (accessible name of the frame).
 */
export function buildCampaignEmbedSnippet(
  options: CampaignEmbedOptions & { title: string },
): string {
  const { width, height } = CAMPAIGN_EMBED_SIZES[options.variant];
  const url = buildCampaignEmbedUrl(options);
  return [
    `<iframe src="${escapeHtmlAttribute(url)}"`,
    `  width="${width}" height="${height}"`,
    `  style="border:0;width:100%;max-width:${width}px;"`,
    `  loading="lazy" allow="clipboard-write"`,
    `  referrerpolicy="no-referrer-when-downgrade"`,
    `  title="${escapeHtmlAttribute(options.title)}"></iframe>`,
  ].join('\n');
}

/**
 * Escapes a value for interpolation into a double-quoted HTML attribute.
 *
 * The snippet is a *string the embedder pastes into their own site*, so a
 * stray `"` in a translated frame title (or an exotic identifier) would break
 * out of the attribute and hand the embedder malformed — potentially
 * injectable — markup. We never render this string as HTML ourselves.
 */
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
