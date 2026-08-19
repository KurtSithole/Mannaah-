import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ExternalLink, Eye, EyeOff, ImageIcon, MoreHorizontal, Sparkles } from 'lucide-react';

import { NoteContent } from '@/components/NoteContent';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthor } from '@/hooks/useAuthor';
import type { useIssueModeration } from '@/hooks/useIssueModeration';
import type { RepoIssueWithStatus } from '@/hooks/useRepoIssues';
import { useToast } from '@/hooks/useToast';
import { AGORA_REPO_WEB_URL, type IssueStatus } from '@/lib/agoraRepo';
import type { ModerationLabel } from '@/lib/agoraModeration';
import { openUrl } from '@/lib/downloadFile';
import { genUserName } from '@/lib/genUserName';
import { sanitizeUrl } from '@/lib/sanitizeUrl';
import { timeAgo } from '@/lib/timeAgo';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<IssueStatus, string> = {
  open: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  resolved: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
  draft: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
};

/** Extract `url` values from NIP-94 `imeta` tags. */
function attachmentUrls(tags: string[][]): string[] {
  return tags
    .filter(([name]) => name === 'imeta')
    .map((tag) => tag.find((field) => field.startsWith('url '))?.slice(4))
    .map((url) => (url ? sanitizeUrl(url) : undefined))
    .filter((url): url is string => Boolean(url));
}

/**
 * One row in the `/issues` list.
 *
 * Everything rendered here comes from an event **any pubkey can publish**, so
 * the hardening is deliberate: the subject is plain text, the body renders with
 * embeds disabled (URLs become inline links rather than cards that fetch remote
 * content on sight), and attached images stay behind a click. Moderator hiding
 * is reactive — the first person to see a malicious screenshot would otherwise
 * be unprotected.
 */
export function IssueListItem({
  issue,
  isHidden,
  isFeatured,
  moderate,
}: {
  issue: RepoIssueWithStatus;
  isHidden: boolean;
  isFeatured: boolean;
  /** Provided only for moderators; omit to render without the kebab. */
  moderate?: ReturnType<typeof useIssueModeration>['moderate'];
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showImages, setShowImages] = useState(false);

  const author = useAuthor(issue.author);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(issue.author);
  const attachments = attachmentUrls(issue.event.tags);

  return (
    <article
      className={cn(
        'rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors',
        isHidden && 'border-destructive/30 bg-destructive/5',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={sanitizeUrl(metadata?.picture)} alt="" />
          <AvatarFallback className="text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('shrink-0', STATUS_STYLES[issue.status])}>
              {t(`support.status.${issue.status}`)}
            </Badge>
            {isFeatured && (
              <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="mr-1 size-3" />
                {t('support.pinned')}
              </Badge>
            )}
            {isHidden && (
              <Badge variant="outline" className="shrink-0 border-destructive/30 bg-destructive/15 text-destructive">
                <EyeOff className="mr-1 size-3" />
                {t('support.hiddenByModerator')}
              </Badge>
            )}
          </div>

          {/* Plain text — never rich-rendered. */}
          <h3 className="mt-1.5 break-words text-[15px] font-medium leading-snug text-foreground">
            {issue.subject}
          </h3>

          <p className="mt-1 text-[13px] text-muted-foreground">
            {t('support.reportedBy', { name: displayName, time: timeAgo(issue.createdAt) })}
          </p>

          {expanded && (
            <div className="mt-3 space-y-3">
              <div className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                <NoteContent event={issue.event} disableEmbeds className="text-sm" />
              </div>

              {attachments.length > 0 && (
                showImages ? (
                  <div className="space-y-2">
                    {attachments.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        loading="lazy"
                        className="max-h-96 w-full rounded-lg border border-border/60 object-contain"
                      />
                    ))}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowImages(true)}>
                    <ImageIcon className="mr-2 size-4" />
                    {t('support.showAttachments', { count: attachments.length })}
                  </Button>
                )
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
              aria-expanded={expanded}
            >
              <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
              {expanded ? t('support.collapse') : t('support.readMore')}
            </button>

            <button
              type="button"
              onClick={() => openUrl(AGORA_REPO_WEB_URL)}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
            >
              <ExternalLink className="size-3.5" />
              {t('support.viewInTracker')}
            </button>
          </div>
        </div>

        {moderate && <IssueModerationMenu issue={issue} isHidden={isHidden} isFeatured={isFeatured} moderate={moderate} />}
      </div>
    </article>
  );
}

/**
 * Moderator kebab for a single issue. Rendered only when the caller passes a
 * `moderate` mutation, which {@link useIssueModerationMenuVisible} gates on
 * roster membership — non-moderators never see the trigger.
 */
function IssueModerationMenu({
  issue,
  isHidden,
  isFeatured,
  moderate,
}: {
  issue: RepoIssueWithStatus;
  isHidden: boolean;
  isFeatured: boolean;
  moderate: ReturnType<typeof useIssueModeration>['moderate'];
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const runAction = async (action: ModerationLabel, toastTitle: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await moderate.mutateAsync({ id: issue.id, action });
      toast({ title: toastTitle, description: issue.subject });
    } catch (error) {
      toast({
        title: t('support.moderation.failed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('support.moderation.aria')}
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t('moderation.menu.label')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isHidden ? (
          <DropdownMenuItem disabled={busy} onClick={() => runAction('unhidden', t('support.moderation.unhidden'))}>
            <Eye className="mr-2 size-4" />
            {t('moderation.menu.unhide')}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="size-3" /> {t('moderation.menu.hiddenState')}
            </span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={busy}
            onClick={() => runAction('hidden', t('support.moderation.hidden'))}
            className="text-destructive focus:text-destructive"
          >
            <EyeOff className="mr-2 size-4" />
            {t('moderation.menu.hide')}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {isFeatured ? (
          <DropdownMenuItem disabled={busy} onClick={() => runAction('unfeatured', t('support.moderation.unfeatured'))}>
            <Sparkles className="mr-2 size-4" />
            {t('support.moderation.unpin')}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="size-3" /> {t('support.moderation.pinnedState')}
            </span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={busy} onClick={() => runAction('featured', t('support.moderation.featured'))}>
            <Sparkles className="mr-2 size-4" />
            {t('support.moderation.pin')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
