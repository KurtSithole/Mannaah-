import { useMemo, useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { CheckCircle2, Clock3, Heart, PauseCircle, Send, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePostComment } from '@/hooks/usePostComment';
import { useToast } from '@/hooks/useToast';
import type { ParsedCampaign } from '@/lib/campaign';
import { cn } from '@/lib/utils';

export type MannaahCampaignStatus = 'active' | 'paused' | 'completed' | 'milestone';

function tag(event: NostrEvent, name: string): string | undefined {
  return event.tags.find(([n]) => n === name)?.[1];
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(timestamp * 1000));
}

interface MannaahCampaignLifecycleProps {
  campaign: ParsedCampaign;
  comments: NostrEvent[];
  isCreator: boolean;
}

/**
 * Humanitarian campaign lifecycle built on Agora's existing NIP-22 comment
 * infrastructure. Updates remain ordinary signed Nostr events and are marked
 * with t=mannaah-update, preserving interoperability without introducing a
 * new event kind.
 */
export function MannaahCampaignLifecycle({ campaign, comments, isCreator }: MannaahCampaignLifecycleProps) {
  const { user } = useCurrentUser();
  const { mutateAsync: postComment, isPending } = usePostComment();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<MannaahCampaignStatus>('active');

  const updates = useMemo(() => {
    return comments
      .filter((event) => tag(event, 't') === 'mannaah-update')
      .sort((a, b) => b.created_at - a.created_at);
  }, [comments]);

  const latestStatus = (tag(updates[0] ?? ({ tags: [] } as NostrEvent), 'mannaah-status') ?? 'active') as MannaahCampaignStatus;

  const publishUpdate = async () => {
    const trimmed = content.trim();
    if (!trimmed || !user || user.pubkey !== campaign.pubkey) return;

    try {
      await postComment({
        root: campaign.event,
        content: trimmed,
        tags: [
          ['t', 'mannaah-update'],
          ['mannaah-status', status],
        ],
      });
      setContent('');
      toast({ title: 'Update published', description: 'Your campaign update is now part of the public campaign history.' });
    } catch {
      toast({ title: 'Could not publish update', description: 'Please try again when your Nostr signer and relays are available.', variant: 'destructive' });
    }
  };

  return (
    <section className="rounded-2xl border border-[#d9cdbd] bg-[#fbf8f2] p-5 sm:p-7 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a765e]">Mannaah campaign journey</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#3f4d42]">What happens next</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6a61]">
            Campaign updates create a transparent history of progress, milestones and outcomes without putting Mannaah in custody of the funds.
          </p>
        </div>
        <Badge className="shrink-0 border-[#b9c8b3] bg-[#edf3ea] text-[#4f654f] hover:bg-[#edf3ea]">
          {latestStatus === 'completed' ? 'Completed' : latestStatus === 'paused' ? 'Paused' : latestStatus === 'milestone' ? 'Milestone' : 'Active'}
        </Badge>
      </div>

      {isCreator && (
        <div className="mt-6 rounded-xl border border-[#ded4c7] bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#3f4d42]">
            <Heart className="h-4 w-4" /> Share an update with people who helped
          </div>
          <Textarea
            className="mt-3 min-h-28 border-[#d9cdbd] bg-[#fffdfa] focus-visible:ring-[#9eaa8e]"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Tell donors what has changed, what their help made possible, or what you still need."
            maxLength={5000}
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as MannaahCampaignStatus)}
              className="rounded-lg border border-[#d9cdbd] bg-white px-3 py-2 text-sm text-[#4b554c]"
            >
              <option value="active">Progress update</option>
              <option value="milestone">Milestone reached</option>
              <option value="paused">Temporarily paused</option>
              <option value="completed">Campaign completed</option>
            </select>
            <Button
              type="button"
              disabled={!content.trim() || isPending}
              onClick={publishUpdate}
              className="bg-[#6d8066] text-white hover:bg-[#5c7057]"
            >
              <Send className="mr-2 h-4 w-4" />
              {isPending ? 'Publishing…' : 'Publish update'}
            </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#777167]">
            Updates are signed and published through Nostr. Public updates may be replicated by other relays and may not be completely removable later.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {updates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d9cdbd] bg-white/60 px-5 py-8 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-[#8a765e]" />
            <p className="mt-2 text-sm font-medium text-[#4b554c]">No campaign updates yet</p>
            <p className="mt-1 text-xs text-[#777167]">When the recipient shares progress, it will appear here.</p>
          </div>
        ) : (
          updates.map((update) => {
            const updateStatus = tag(update, 'mannaah-status') as MannaahCampaignStatus | undefined;
            const Icon = updateStatus === 'completed' ? CheckCircle2 : updateStatus === 'paused' ? PauseCircle : updateStatus === 'milestone' ? Sparkles : Clock3;
            return (
              <article key={update.id} className="rounded-xl border border-[#ded4c7] bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', updateStatus === 'completed' ? 'text-[#6d8066]' : 'text-[#a27b55]')} />
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a765e]">
                    {updateStatus === 'completed' ? 'Outcome' : updateStatus === 'milestone' ? 'Milestone' : updateStatus === 'paused' ? 'Paused' : 'Progress update'}
                  </span>
                  <span className="ml-auto text-xs text-[#8b857b]">{formatDate(update.created_at)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#454940]">{update.content}</p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
