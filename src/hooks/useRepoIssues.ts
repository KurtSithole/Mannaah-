import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import {
  AGORA_REPO_COORDINATE,
  GIT_ISSUE_KIND,
  GIT_STATUS_KINDS,
  ISSUE_RELAYS,
  issueStatusFromKind,
  parseRepoIssue,
  resolveIssueStatus,
  type IssueStatus,
  type RepoIssue,
} from '@/lib/agoraRepo';

/** An issue plus its resolved lifecycle state. */
export interface RepoIssueWithStatus extends RepoIssue {
  status: IssueStatus;
  /** When the winning status event was published, if any. */
  statusAt?: number;
}

/**
 * Every issue filed against Agora's repository, newest first, with each one's
 * trusted status resolved.
 *
 * Read from {@link ISSUE_RELAYS} rather than the app pool — the repository's
 * grasp relay is where `ngit` and gitworkshop publish, and Agora's own relays
 * are not in the repo's announced relay list. Issues and status events come
 * back in a single request: NIP-34 requires a status to tag both its ticket
 * (`e`) and the repository (`a`), so one `#a` filter covers both kinds.
 *
 * **Deliberately not filtered by `authors`.** Anyone may file an issue against
 * a public repository — that is the entire point of the reporter. Suppressing
 * abuse is the moderation layer's job (see `useIssueModeration`), not this
 * query's.
 */
export function useRepoIssues() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['repo-issues', AGORA_REPO_COORDINATE],
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<RepoIssueWithStatus[]> => {
      const events = await nostr.group([...ISSUE_RELAYS]).query(
        [
          { kinds: [GIT_ISSUE_KIND], '#a': [AGORA_REPO_COORDINATE], limit: 200 },
          { kinds: [...GIT_STATUS_KINDS], '#a': [AGORA_REPO_COORDINATE], limit: 500 },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]) },
      );

      const statusKinds: readonly number[] = GIT_STATUS_KINDS;
      const statuses = events.filter((event) => statusKinds.includes(event.kind));

      // Querying a relay group can return the same event from several relays.
      const seen = new Set<string>();
      const issues: RepoIssueWithStatus[] = [];

      for (const event of events) {
        if (event.kind !== GIT_ISSUE_KIND || seen.has(event.id)) continue;
        seen.add(event.id);

        const issue = parseRepoIssue(event);
        if (!issue) continue;

        const status = resolveIssueStatus(issue, statuses);
        issues.push({
          ...issue,
          status: issueStatusFromKind(status?.kind),
          statusAt: status?.createdAt,
        });
      }

      return issues.sort((a, b) => b.createdAt - a.createdAt);
    },
  });
}
