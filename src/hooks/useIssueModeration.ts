import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCampaignModerators } from './useCampaignModerators';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import {
  AGORA_MODERATION_NAMESPACE,
  EMPTY_EVENT_MODERATION_DATA,
  LABEL_KIND,
  foldEventModerationLabels,
  type EventModerationData,
  type ModerationLabel,
} from '@/lib/agoraModeration';

/**
 * Moderation state for the in-app issue tracker on `/issues`.
 *
 * Issues are kind 1621 regular events that **anyone** can publish against
 * Agora's repository coordinate, and the issues page renders them to every
 * user. Hiding is therefore the defense against a stranger publishing abuse or
 * a phishing link into that list; featuring pins genuine known issues to the
 * top so users find them before filing a duplicate.
 *
 * Labels ride the same `agora.moderation` namespace and the same Team Soapbox
 * moderator roster as campaigns, organizations, and pledges — the only
 * difference is that they target an event id (`e`) rather than an addressable
 * coordinate (`a`). See {@link foldEventModerationLabels}.
 *
 * Labels are published and read through the **app's own relay pool**, not the
 * repository's relays. The grasp relay is the source of truth for the issues
 * themselves; Agora's relays hold Agora's opinion about them.
 *
 * @param issueIds Ids of the issues currently on screen. The query filters
 * relay-side on exactly these ids, which is what scopes this label stream from
 * every other one — an `e` tag carries no kind prefix to filter on.
 */
export function useIssueModeration(issueIds: readonly string[]) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { data: moderators } = useCampaignModerators();

  // Sorted so the key is stable regardless of the order issues arrived in.
  const ids = [...issueIds].sort();
  const moderatorsKey = moderators ? [...moderators].sort().join(',') : '';

  // Gated exactly like `useCampaignModeration`: never fire with an empty
  // `authors:` filter, which would trust a label from any pubkey and let a
  // stranger hide real bug reports.
  const moderationQuery = useQuery({
    queryKey: ['issue-moderation', moderatorsKey, ids.join(',')],
    enabled: moderators !== undefined && ids.length > 0,
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<EventModerationData> => {
      if (!moderators?.length || !ids.length) {
        return { ...EMPTY_EVENT_MODERATION_DATA, moderators: moderators ? [...moderators] : [] };
      }

      const events = await nostr.query(
        [{
          kinds: [LABEL_KIND],
          authors: moderators,
          '#L': [AGORA_MODERATION_NAMESPACE],
          '#e': ids,
          limit: 1000,
        }],
        { signal },
      );

      return foldEventModerationLabels(events, [...moderators]);
    },
  });

  const moderate = useMutation({
    mutationFn: async ({
      id,
      action,
      rank,
    }: {
      /** Event id of the issue being labeled. */
      id: string;
      action: ModerationLabel;
      /** Explicit sort key for the pinned row; see `ModerationData.featuredOrder`. */
      rank?: number;
    }) => {
      if (!/^[0-9a-f]{64}$/.test(id)) {
        throw new Error('Issue id must be a 64-character hex event id.');
      }

      const tags: string[][] = [
        ['L', AGORA_MODERATION_NAMESPACE],
        ['l', action, AGORA_MODERATION_NAMESPACE],
        ['e', id],
        ['alt', `Issue moderation: ${action}`],
      ];
      if (rank !== undefined && Number.isFinite(rank)) {
        tags.push(['rank', String(Math.trunc(rank))]);
      }

      return publishEvent({ kind: LABEL_KIND, content: '', tags });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-moderation'] });
    },
  });

  return {
    data: moderationQuery.data ?? EMPTY_EVENT_MODERATION_DATA,
    isLoading: moderationQuery.isLoading,
    isReady: moderationQuery.isSuccess,
    moderate,
  };
}

/**
 * True when the logged-in account may hide or pin issues. Callers use this to
 * decide whether to pass the `moderate` mutation down to a row — non-moderators
 * never render the kebab, and a label they published would be dropped by the
 * `authors:` filter on read anyway.
 */
export function useIssueModerationMenuVisible(): boolean {
  const { user } = useCurrentUser();
  const { data: moderators } = useCampaignModerators();
  return Boolean(user && moderators?.includes(user.pubkey));
}
