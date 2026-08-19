import type { NostrEvent } from '@nostrify/nostrify';

import { DITTO_RELAYS } from '@/lib/appRelays';
import { isNostrId } from '@/lib/nostrId';

/**
 * Agora's own NIP-34 issue tracker — the destination for in-app bug reports
 * filed from `/issues`.
 *
 * Reports are published as kind 1621 issues against the repository
 * announcement below, which lives on an ngit/grasp relay. This is the same
 * tracker the team reads with `ngit` and gitworkshop.dev, so an in-app report
 * lands in the normal development workflow rather than a separate inbox.
 *
 * **The repository coordinate, maintainer set, and relay list are hardcoded
 * snapshots** rather than resolved from a live kind 30617 fetch. The reason is
 * the same one documented on {@link CAMPAIGN_MODERATORS}: resolving the
 * announcement would put a relay round-trip (up to an EOSE timeout) on the
 * critical path of a page a user opens *because something is already broken*,
 * which is the worst possible moment to depend on the network. The roster
 * changes rarely — update the constants here and cut a release.
 */

/** NIP-34 repository announcement. */
export const GIT_REPO_KIND = 30617;
/** NIP-34 issue. */
export const GIT_ISSUE_KIND = 1621;
/** NIP-34 open status. */
export const GIT_STATUS_OPEN_KIND = 1630;
/** NIP-34 applied / resolved status. */
export const GIT_STATUS_APPLIED_KIND = 1631;
/** NIP-34 closed status. */
export const GIT_STATUS_CLOSED_KIND = 1632;
/** NIP-34 draft status. */
export const GIT_STATUS_DRAFT_KIND = 1633;

export const GIT_STATUS_KINDS = [
  GIT_STATUS_OPEN_KIND,
  GIT_STATUS_APPLIED_KIND,
  GIT_STATUS_CLOSED_KIND,
  GIT_STATUS_DRAFT_KIND,
] as const;

export type GitStatusKind = (typeof GIT_STATUS_KINDS)[number];

/** Owner of the Agora repository announcement (`npub10qdp2fc…`). */
export const AGORA_REPO_OWNER = '781a1527055f74c1f70230f10384609b34548f8ab6a0a6caa74025827f9fdae5';

/** `d` tag of the Agora repository announcement. */
export const AGORA_REPO_IDENTIFIER = 'agora';

/** Canonical `30617:<owner>:<d>` coordinate every report `a`-tags. */
export const AGORA_REPO_COORDINATE = `${GIT_REPO_KIND}:${AGORA_REPO_OWNER}:${AGORA_REPO_IDENTIFIER}`;

/**
 * Maintainers from the announcement's `maintainers` tag, including the owner.
 * Used for the issue's `p` tags (so maintainers get a notification) and as the
 * trust set for status events — see {@link resolveIssueStatus}.
 */
export const AGORA_REPO_MAINTAINERS: readonly string[] = [
  AGORA_REPO_OWNER,
  '932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d',
];

/** Human-readable tracker, from the announcement's `web` tag. */
export const AGORA_REPO_WEB_URL =
  'https://gitworkshop.dev/npub10qdp2fc9ta6vraczxrcs8prqnv69fru2k6s2dj48gqjcylulmtjsg9arpj/relay.ngit.dev/agora';

/** The grasp relay named in the announcement's `relays` tag. */
export const NGIT_RELAY = 'wss://relay.ngit.dev';

/**
 * Where issues are read from and published to.
 *
 * `relay.ngit.dev` is the repository's declared activity relay — the one
 * `ngit` and gitworkshop read — so it is the relay that actually matters for a
 * maintainer seeing the report. The Ditto relays are added so reports also
 * land on infrastructure the team controls, and so the issue list on `/issues`
 * still renders when the grasp relay is unreachable.
 */
export const ISSUE_RELAYS: readonly string[] = [NGIT_RELAY, ...DITTO_RELAYS];

/** Label applied to every issue filed through the in-app reporter. */
export const IN_APP_REPORT_LABEL = 'in-app-report';

/** Longest label we publish; longer entries are useless as filters. */
export const MAX_ISSUE_LABEL_LENGTH = 40;
/** Most labels one issue may carry. */
export const MAX_ISSUE_LABELS = 8;

/** Bounds on the report form, enforced before signing. */
export const MAX_SUBJECT_LENGTH = 120;
export const MIN_SUBJECT_LENGTH = 8;
export const MIN_BODY_LENGTH = 20;
export const MAX_BODY_LENGTH = 8000;

// ─────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────

/** A parsed kind 1621 issue. */
export interface RepoIssue {
  event: NostrEvent;
  id: string;
  /** `subject` tag, falling back to the first line of content. */
  subject: string;
  content: string;
  labels: string[];
  author: string;
  createdAt: number;
}

function firstTagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find(([n]) => n === name)?.[1];
}

/**
 * Parse a kind 1621 event into an issue, or `undefined` when it isn't one we
 * can render. Events with neither a `subject` tag nor any content are dropped
 * — there would be nothing to show in the list.
 */
export function parseRepoIssue(event: NostrEvent): RepoIssue | undefined {
  if (event.kind !== GIT_ISSUE_KIND || !isNostrId(event.pubkey)) return undefined;

  const content = event.content.trim();
  const subject = firstTagValue(event, 'subject')?.trim()
    || content.split('\n', 1)[0]?.trim().slice(0, MAX_SUBJECT_LENGTH);
  if (!subject) return undefined;

  return {
    event,
    id: event.id,
    subject,
    content,
    labels: normalizeIssueLabels(
      event.tags.filter(([n]) => n === 't').map(([, v]) => v ?? ''),
    ),
    author: event.pubkey,
    createdAt: event.created_at,
  };
}

/** Lifecycle state of an issue, derived from its newest trusted status event. */
export type IssueStatus = 'open' | 'resolved' | 'closed' | 'draft';

/** A parsed NIP-34 status event rooted in an issue. */
export interface IssueStatusEvent {
  event: NostrEvent;
  kind: GitStatusKind;
  issueId: string;
  author: string;
  createdAt: number;
}

function isStatusKind(kind: number): kind is GitStatusKind {
  return (GIT_STATUS_KINDS as readonly number[]).includes(kind);
}

/** Parse a status event that roots itself in an issue via its `e` tag. */
export function parseIssueStatusEvent(event: NostrEvent): IssueStatusEvent | undefined {
  if (!isStatusKind(event.kind) || !isNostrId(event.pubkey)) return undefined;
  // NIP-34 roots a status in the ticket with a plain `e` tag; a root marker is
  // used when the status also references the repository's other events.
  const issueId = event.tags.find(([n, v, , marker]) =>
    n === 'e' && isNostrId(v) && (marker === undefined || marker === 'root')
  )?.[1];
  if (!issueId) return undefined;
  return { event, kind: event.kind, issueId, author: event.pubkey, createdAt: event.created_at };
}

/** Map a status kind to the lifecycle state it represents. */
export function issueStatusFromKind(kind: GitStatusKind | undefined): IssueStatus {
  switch (kind) {
    case GIT_STATUS_CLOSED_KIND: return 'closed';
    case GIT_STATUS_DRAFT_KIND: return 'draft';
    case GIT_STATUS_APPLIED_KIND: return 'resolved';
    default: return 'open';
  }
}

/**
 * Newest **trusted** status for an issue.
 *
 * Anyone can publish a kind 1632 naming any event, so an unfiltered read would
 * let a stranger mark real bugs "closed" in our own support UI. Only the
 * issue's author and the repository's maintainers are trusted, matching how
 * NIP-34 clients (and gitworkshop) resolve ticket state.
 */
export function resolveIssueStatus(
  issue: Pick<RepoIssue, 'id' | 'author'>,
  statuses: readonly NostrEvent[],
  maintainers: readonly string[] = AGORA_REPO_MAINTAINERS,
): IssueStatusEvent | undefined {
  const trusted = new Set([issue.author, ...maintainers]);
  return statuses
    .map(parseIssueStatusEvent)
    .filter((status): status is IssueStatusEvent =>
      Boolean(status && status.issueId === issue.id && trusted.has(status.author)))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

// ─────────────────────────────────────────────────────────────────────
// Writing
// ─────────────────────────────────────────────────────────────────────

/**
 * Normalize labels for publication: lowercased, whitespace-collapsed,
 * de-duplicated, and bounded in both length and count so a typo can't publish
 * an unusable tag. Matches how {@link parseRepoIssue} reads them back.
 */
export function normalizeIssueLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const value of labels) {
    const label = value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_ISSUE_LABEL_LENGTH);
    if (label) seen.add(label);
    if (seen.size >= MAX_ISSUE_LABELS) break;
  }
  return [...seen];
}

/** An unsigned event ready for a signer. */
export interface IssueTemplate {
  kind: number;
  content: string;
  tags: string[][];
}

/**
 * Build the kind 1621 issue for a report. The tag shape matches what ngit and
 * gitworkshop publish and read: the repository `a` tag with a relay hint, a
 * `p` tag per maintainer, a `subject`, a NIP-31 `alt`, `t` labels, and any
 * NIP-94 `imeta` tags for attached screenshots.
 */
export function buildIssueTemplate({
  subject,
  body,
  labels = [],
  media = [],
}: {
  subject: string;
  body: string;
  labels?: readonly string[];
  media?: readonly string[][];
}): IssueTemplate {
  const recipients = [...new Set(AGORA_REPO_MAINTAINERS)].filter(isNostrId);
  return {
    kind: GIT_ISSUE_KIND,
    content: body,
    tags: [
      ['a', AGORA_REPO_COORDINATE, NGIT_RELAY],
      ['subject', subject],
      ['alt', `git repository issue: ${subject}`],
      ...recipients.map((pubkey) => ['p', pubkey, NGIT_RELAY]),
      ...normalizeIssueLabels([IN_APP_REPORT_LABEL, ...labels]).map((label) => ['t', label]),
      ...media.map((tag) => [...tag]),
    ],
  };
}

/**
 * Build the environment footer appended to a report body.
 *
 * `full` is used for signed reports. `minimal` drops the relay list and user
 * agent, which are the two fingerprinting fields — an anonymous report that
 * carried them would be trivially linkable back to the reporter's account by
 * anyone who can see both.
 */
export function buildDiagnosticsBlock({
  platform,
  relays,
  detail,
}: {
  platform: string;
  /** Effective relay URLs. Omit for the minimal (anonymous) variant. */
  relays?: readonly string[];
  detail: 'full' | 'minimal';
}): string {
  const version = `${import.meta.env.VERSION}${import.meta.env.COMMIT_TAG ? '' : '+'}`;
  const commit = import.meta.env.COMMIT_SHA ? ` (${import.meta.env.COMMIT_SHA})` : '';

  const lines = [
    '',
    '---',
    '',
    '**Environment**',
    '',
    `- Agora: v${version}${commit}`,
    `- Built: ${import.meta.env.BUILD_DATE}`,
    `- Platform: ${platform}`,
  ];

  if (detail === 'full') {
    lines.push(`- User agent: ${navigator.userAgent}`);
    if (relays?.length) lines.push(`- Relays: ${relays.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Patterns for secrets a user might paste into a bug report about the wallet.
 * The reporter warns rather than strips — silently editing someone's report is
 * worse than telling them what they're about to publish.
 */
const SECRET_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'nsec', re: /\bnsec1[02-9ac-hj-np-z]{20,}/i },
  { id: 'silentPayment', re: /\bsp1[02-9ac-hj-np-z]{40,}/i },
  { id: 'xpub', re: /\b(?:x|y|z|v)pub[1-9A-HJ-NP-Za-km-z]{50,}/ },
  { id: 'bitcoinAddress', re: /\b(?:bc1[02-9ac-hj-np-z]{20,}|[13][1-9A-HJ-NP-Za-km-z]{25,34})\b/ },
  { id: 'seedPhrase', re: /(?:\b[a-z]{3,8}\b[ \t]+){11,}\b[a-z]{3,8}\b/i },
];

/** Ids of secret patterns found in the text, for warning copy. */
export function detectSensitiveStrings(text: string): string[] {
  return SECRET_PATTERNS.filter(({ re }) => re.test(text)).map(({ id }) => id);
}
