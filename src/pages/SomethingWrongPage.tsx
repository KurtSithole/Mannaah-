import { NSecSigner } from '@nostrify/nostrify';
import { Capacitor } from '@capacitor/core';
import { useSeoMeta } from '@unhead/react';
import { useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { AlertTriangle, Check, Copy, ExternalLink, ImagePlus, Loader2, X } from 'lucide-react';

import { IssueListItem } from '@/components/IssueListItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIssueModeration, useIssueModerationMenuVisible } from '@/hooks/useIssueModeration';
import { useRepoIssues } from '@/hooks/useRepoIssues';
import { useSubmitIssue } from '@/hooks/useSubmitIssue';
import { useToast } from '@/hooks/useToast';
import { useUploadFile } from '@/hooks/useUploadFile';
import {
  AGORA_REPO_WEB_URL,
  MAX_BODY_LENGTH,
  MAX_SUBJECT_LENGTH,
  MIN_BODY_LENGTH,
  MIN_SUBJECT_LENGTH,
  NGIT_RELAY,
  buildDiagnosticsBlock,
  detectSensitiveStrings,
} from '@/lib/agoraRepo';
import { getEffectiveRelays } from '@/lib/appRelays';
import { openUrl } from '@/lib/downloadFile';
import { cn } from '@/lib/utils';

/** Report categories, each publishing one `t` label alongside `in-app-report`. */
const CATEGORIES = ['bug', 'wallet', 'content', 'feature'] as const;
type Category = (typeof CATEGORIES)[number];

/** Minimum gap between two reports from this device. */
const COOLDOWN_MS = 60_000;
const COOLDOWN_KEY = 'agora:issues:last-report';

export function SomethingWrongPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  const [category, setCategory] = useState<Category>('bug');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [media, setMedia] = useState<{ url: string; tag: string[] }[]>([]);
  const [submitted, setSubmitted] = useState<{ id: string; pubkey: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const issuesQuery = useRepoIssues();
  const issues = useMemo(() => issuesQuery.data ?? [], [issuesQuery.data]);
  const moderation = useIssueModeration(useMemo(() => issues.map((issue) => issue.id), [issues]));
  const isModerator = useIssueModerationMenuVisible();
  const submitIssue = useSubmitIssue();

  // Logged-out visitors can only file without an account, so the switch is
  // forced on rather than silently failing at submit time. The disclosure
  // below states what that means, so the switch needs no caption of its own.
  const anonymousLocked = !user;
  const effectivelyAnonymous = anonymous || anonymousLocked;

  // A separate throwaway key for Blossom auth. Reusing the issue's key would
  // tie the upload to the report; reusing the account's key would defeat the
  // point entirely.
  const anonUploadSigner = useMemo(
    () => (effectivelyAnonymous ? new NSecSigner(generateSecretKey()) : undefined),
    [effectivelyAnonymous],
  );
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile(anonUploadSigner);

  useSeoMeta({
    title: `${t('support.seoTitle')} | ${config.appName}`,
    description: t('support.seoDescription', { appName: config.appName }),
  });

  const visibleIssues = useMemo(() => {
    const matches = issues.filter((issue) =>
      !moderation.data.hiddenIds.has(issue.id) || isModerator);

    // Pinned issues float to the top by descending rank, then the rest by
    // recency.
    return matches.sort((a, b) => {
      const aRank = moderation.data.featuredOrder.get(a.id);
      const bRank = moderation.data.featuredOrder.get(b.id);
      if (aRank !== undefined && bRank !== undefined) return bRank - aRank;
      if (aRank !== undefined) return -1;
      if (bRank !== undefined) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [issues, moderation.data, isModerator]);

  const diagnostics = useMemo(() => {
    const relays = getEffectiveRelays(
      config.relayMetadata,
      config.useAppRelays,
      config.useUserRelays,
    ).relays.map((relay) => relay.url);

    return buildDiagnosticsBlock({
      platform: Capacitor.getPlatform(),
      relays,
      detail: effectivelyAnonymous ? 'minimal' : 'full',
    });
  }, [config, effectivelyAnonymous]);

  const secrets = useMemo(() => detectSensitiveStrings(`${subject}\n${body}`), [subject, body]);
  const hasNsec = secrets.includes('nsec');

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  const canSubmit = trimmedSubject.length >= MIN_SUBJECT_LENGTH
    && trimmedBody.length >= MIN_BODY_LENGTH
    && trimmedBody.length <= MAX_BODY_LENGTH
    && !hasNsec
    && !submitIssue.isPending
    && !isUploading;

  const attach = async (file: File | undefined) => {
    if (!file) return;
    try {
      const tags = await uploadFile(file);
      const url = tags[0]?.[1];
      if (!url) throw new Error('Upload returned no URL.');
      setMedia((current) => [
        ...current,
        { url, tag: ['imeta', ...tags.map((tag) => `${tag[0]} ${tag[1]}`)] },
      ]);
    } catch (error) {
      toast({
        title: t('support.form.attachment.failed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  /** Accept a screenshot pasted from the clipboard, not just picked from disk. */
  const onPaste = (event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData.files)
      .find((entry) => entry.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    void attach(file);
  };

  const onSubmit = async () => {
    const last = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) {
      toast({ title: t('support.form.errors.cooldown'), variant: 'destructive' });
      return;
    }

    try {
      const event = await submitIssue.mutateAsync({
        subject: trimmedSubject.slice(0, MAX_SUBJECT_LENGTH),
        body: includeDiagnostics ? `${trimmedBody}\n${diagnostics}` : trimmedBody,
        labels: [category],
        media: media.map((item) => item.tag),
        anonymous: effectivelyAnonymous,
      });

      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      setSubmitted({ id: event.id, pubkey: event.pubkey });
      setSubject('');
      setBody('');
      setMedia([]);
    } catch (error) {
      toast({
        title: t('support.form.errors.failed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const onCopyId = async () => {
    if (!submitted) return;
    const nevent = nip19.neventEncode({
      id: submitted.id,
      author: submitted.pubkey,
      relays: [NGIT_RELAY],
    });
    await navigator.clipboard.writeText(nevent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen px-4 pb-10 pt-5 sm:px-6 sidebar:pb-0">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('support.title')}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            {t('support.subtitle', { appName: config.appName })}
          </p>
        </header>

        {/* ── File a report ────────────────────────────────────────── */}
        <section className="space-y-4" aria-labelledby="support-form">
          <h2 id="support-form" className="text-lg font-semibold text-foreground">
            {t('support.formTitle')}
          </h2>

          {submitted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground">{t('support.success.title')}</p>
                  <p className="text-sm text-muted-foreground">{t('support.success.description')}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onCopyId}>
                  {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                  {copied ? t('support.success.copied') : t('support.success.copyId')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void openUrl(AGORA_REPO_WEB_URL)}>
                  <ExternalLink className="mr-2 size-4" />
                  {t('support.success.viewTracker')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSubmitted(null)}>
                  {t('support.success.fileAnother')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">
                  {t('support.form.categoryLabel')}
                </legend>
                <RadioGroup
                  value={category}
                  onValueChange={(value) => setCategory(value as Category)}
                  className="grid gap-x-6 gap-y-2 sm:grid-cols-2"
                >
                  {CATEGORIES.map((value) => (
                    <div key={value} className="flex items-center gap-2.5">
                      <RadioGroupItem value={value} id={`support-category-${value}`} />
                      <Label htmlFor={`support-category-${value}`} className="cursor-pointer text-sm font-normal">
                        {t(`support.form.category.${value}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="support-subject">{t('support.form.subjectLabel')}</Label>
                <Input
                  id="support-subject"
                  value={subject}
                  maxLength={MAX_SUBJECT_LENGTH}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t('support.form.subjectPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="support-body">{t('support.form.bodyLabel')}</Label>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void attach(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                  {/* Also a paste target: focus it and press Ctrl/Cmd+V to
                      attach a screenshot straight from the clipboard. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isUploading}
                    onPaste={onPaste}
                    onClick={() => fileInput.current?.click()}
                    className="-my-1 h-auto py-1 text-muted-foreground"
                  >
                    {isUploading
                      ? <Loader2 className="mr-2 size-4 animate-spin" />
                      : <ImagePlus className="mr-2 size-4" />}
                    {isUploading ? t('support.form.attachment.uploading') : t('support.form.attachment.add')}
                  </Button>
                </div>

                <Textarea
                  id="support-body"
                  value={body}
                  rows={5}
                  maxLength={MAX_BODY_LENGTH}
                  onChange={(event) => setBody(event.target.value)}
                  onPaste={onPaste}
                  placeholder={t('support.form.bodyPlaceholder')}
                />

                {media.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {media.map((item) => (
                      <span
                        key={item.url}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                      >
                        <ImagePlus className="size-3.5 text-muted-foreground" />
                        {t('support.form.attachment.item')}
                        <button
                          type="button"
                          aria-label={t('support.form.attachment.remove')}
                          onClick={() => setMedia((current) => current.filter((entry) => entry.url !== item.url))}
                          className="text-muted-foreground transition-colors hover:text-destructive focus-visible:text-destructive focus-visible:outline-none"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="support-diagnostics" className="cursor-pointer font-normal">
                    {t('support.form.diagnosticsLabel')}
                  </Label>
                  <Switch
                    id="support-diagnostics"
                    checked={includeDiagnostics}
                    onCheckedChange={setIncludeDiagnostics}
                  />
                </div>
                {includeDiagnostics && (
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    {diagnostics.trim()}
                  </pre>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="support-anonymous" className="cursor-pointer font-normal">
                      {t('support.form.anonymousLabel')}
                    </Label>
                    <Switch
                      id="support-anonymous"
                      checked={effectivelyAnonymous}
                      disabled={anonymousLocked}
                      onCheckedChange={setAnonymous}
                    />
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    {effectivelyAnonymous
                      ? t('support.form.disclosureAnonymous')
                      : t('support.form.disclosureSigned')}
                  </p>
                </div>
              </div>

              {secrets.length > 0 && (
                <div
                  className={cn(
                    'flex items-start gap-2.5 rounded-lg p-3',
                    hasNsec ? 'bg-destructive/10' : 'bg-amber-500/10',
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      hasNsec ? 'text-destructive' : 'text-amber-600 dark:text-amber-500',
                    )}
                  />
                  <div className="space-y-1.5">
                    <p className="text-[13px] font-medium text-foreground">
                      {hasNsec ? t('support.form.nsecBlocked') : t('support.form.secretWarning')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {secrets.map((secret) => (
                        <Badge key={secret} variant="outline" className="text-[11px]">
                          {t(`support.form.secretKinds.${secret}`)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button className="w-full" disabled={!canSubmit} onClick={() => void onSubmit()}>
                {submitIssue.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {submitIssue.isPending ? t('support.form.submitting') : t('support.form.submit')}
              </Button>
            </div>
          )}
        </section>

        {/* ── Existing reports ─────────────────────────────────────── */}
        <section className="space-y-3" aria-labelledby="support-existing">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="support-existing" className="text-lg font-semibold text-foreground">
              {t('support.existingTitle')}
            </h2>
            <button
              type="button"
              onClick={() => void openUrl(AGORA_REPO_WEB_URL)}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
            >
              <ExternalLink className="size-3.5" />
              {t('support.openTracker')}
            </button>
          </div>

          {issuesQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : issuesQuery.isError ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-6 text-center">
              <p className="mx-auto max-w-sm text-muted-foreground">{t('support.loadError')}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => issuesQuery.refetch()}>
                {t('support.retry')}
              </Button>
            </div>
          ) : visibleIssues.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-6 text-center">
              <p className="mx-auto max-w-sm text-muted-foreground">{t('support.noIssues')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleIssues.map((issue) => (
                <li key={issue.id}>
                  <IssueListItem
                    issue={issue}
                    isHidden={moderation.data.hiddenIds.has(issue.id)}
                    isFeatured={moderation.data.featuredIds.has(issue.id)}
                    moderate={isModerator ? moderation.moderate : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
