import { NSecSigner } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateSecretKey } from 'nostr-tools';

import { useAppContext } from './useAppContext';
import { useCurrentUser } from './useCurrentUser';
import { ISSUE_RELAYS, buildIssueTemplate } from '@/lib/agoraRepo';

import type { NostrEvent } from '@nostrify/nostrify';

export interface SubmitIssueInput {
  subject: string;
  body: string;
  labels?: readonly string[];
  /** NIP-94 `imeta` tags for attached screenshots. */
  media?: readonly string[][];
  /**
   * Sign with a throwaway key instead of the logged-in account. The key is
   * generated here, used once, and discarded — the report cannot afterwards be
   * edited, deleted, or replied to by its author.
   */
  anonymous: boolean;
}

/**
 * Publish a bug report as a NIP-34 kind 1621 issue.
 *
 * This does **not** go through `useNostrPublish`, which can only publish to the
 * app's own relay pool. A report has to reach the repository's declared
 * activity relays or no maintainer will ever see it, so the event is signed
 * directly and delivered to {@link ISSUE_RELAYS}.
 *
 * Delivery succeeds if **any** relay acknowledges. A report that reached no
 * relay throws, so the form can keep the user's text instead of clearing it and
 * pretending the report was filed.
 */
export function useSubmitIssue() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subject,
      body,
      labels = [],
      media = [],
      anonymous,
    }: SubmitIssueInput): Promise<NostrEvent> => {
      const signer = anonymous ? new NSecSigner(generateSecretKey()) : user?.signer;
      if (!signer) {
        throw new Error('Log in or submit without your account to file a report.');
      }

      const template = buildIssueTemplate({ subject, body, labels, media });
      const event = await signer.signEvent({
        ...template,
        tags: [...template.tags, ['client', config.clientName ?? config.appName]],
        created_at: Math.floor(Date.now() / 1000),
      });

      const results = await Promise.allSettled(
        ISSUE_RELAYS.map((relay) =>
          nostr.relay(relay).event(event, { signal: AbortSignal.timeout(10_000) }),
        ),
      );

      if (!results.some((result) => result.status === 'fulfilled')) {
        const reason = results
          .map((result) => (result.status === 'rejected' ? String(result.reason) : ''))
          .find(Boolean);
        throw new Error(
          reason
            ? `No relay accepted the report: ${reason}`
            : 'No relay accepted the report.',
        );
      }

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repo-issues'] });
    },
  });
}
