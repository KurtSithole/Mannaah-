import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink, Monitor, Moon, Sun } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from '@/hooks/useToast';
import {
  CAMPAIGN_EMBED_CONFIG_MESSAGE,
  CAMPAIGN_EMBED_SIZES,
  CAMPAIGN_EMBED_THEMES,
  CAMPAIGN_EMBED_VARIANTS,
  type CampaignEmbedTheme,
  type CampaignEmbedVariant,
  DEFAULT_CAMPAIGN_EMBED_THEME,
  DEFAULT_CAMPAIGN_EMBED_VARIANT,
  buildCampaignEmbedSnippet,
  buildCampaignEmbedUrl,
  isCampaignEmbedHeightMessage,
  isCampaignEmbedReadyMessage,
} from '@/lib/campaignEmbed';

interface CampaignEmbedDialogProps {
  /** The campaign's `naddr1…` identifier. */
  naddr: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const THEME_ICONS: Record<CampaignEmbedTheme, typeof Monitor> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Theme labels reuse the app's own appearance-setting strings — same three
 * concepts, already translated in every locale, and consistent with what the
 * user sees in Settings. Note the URL parameter stays `auto` while the label
 * reads "System"; the param name is a wire format and isn't worth churning.
 */
const THEME_LABEL_KEYS: Record<CampaignEmbedTheme, string> = {
  auto: 'settings.appearance.system',
  light: 'settings.appearance.light',
  dark: 'settings.appearance.dark',
};

/**
 * Embed builder for a campaign: pick a widget and a theme, see it rendered
 * live, then copy the snippet.
 *
 * Presented as a near-full-height bottom sheet rather than a centered modal.
 * The preview is the point of the screen and the `full` widget alone is 900px
 * tall, so a dialog sized to the content would have been a scroll-in-a-scroll;
 * at this size the controls sit beside the preview on desktop and stack under
 * it on mobile, and the strip of page left visible at the top doubles as a
 * dismiss target.
 *
 * The preview is a real `<iframe>` pointed at the real `/embed/campaign/…`
 * URL — not a mock-up of one — so what the embedder approves is exactly what
 * their visitors get, down to the relay fetch and the on-chain balance. It
 * also dogfoods the height `postMessage` the widget sends: the preview frame
 * auto-sizes off the same protocol a host-side loader would use, which means
 * that protocol can't silently rot.
 */
export function CampaignEmbedDialog({ naddr, open, onOpenChange }: CampaignEmbedDialogProps) {
  const { t } = useTranslation();
  const [variant, setVariant] = useState<CampaignEmbedVariant>(DEFAULT_CAMPAIGN_EMBED_VARIANT);
  const [theme, setTheme] = useState<CampaignEmbedTheme>(DEFAULT_CAMPAIGN_EMBED_THEME);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // The frame's `src`, frozen for the life of one open dialog. Pointing it at
  // `previewUrl` would reload the widget on every click; instead it loads once
  // and subsequent choices are posted in. `null` while closed so the frame
  // unmounts and a reopen starts from the current selection.
  const [frameUrl, setFrameUrl] = useState<string | null>(null);

  const origin = window.location.origin;
  const iframeTitle = t('embedCampaign.iframeTitle');
  const snippetLabel = t('embedCampaign.snippetLabel');

  const previewUrl = useMemo(
    () => buildCampaignEmbedUrl({ naddr, variant, theme, origin }),
    [naddr, variant, theme, origin],
  );
  const snippet = useMemo(
    () => buildCampaignEmbedSnippet({ naddr, variant, theme, origin, title: iframeTitle }),
    [naddr, variant, theme, origin, iframeTitle],
  );

  const { width, height: fallbackHeight } = CAMPAIGN_EMBED_SIZES[variant];

  // Latest selection, readable from effects that must not re-run when it
  // changes (the frame URL is deliberately stale, and the message listener
  // shouldn't resubscribe on every click).
  const configRef = useRef({ variant, theme });
  configRef.current = { variant, theme };

  const postConfig = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: CAMPAIGN_EMBED_CONFIG_MESSAGE, ...configRef.current },
      origin,
    );
  }, [origin]);

  useEffect(() => {
    setFrameUrl(
      open
        ? buildCampaignEmbedUrl({ naddr, ...configRef.current, origin })
        : null,
    );
  }, [open, naddr, origin]);

  // Retarget the running frame. Harmless if it isn't listening yet — the
  // widget's ready signal triggers a resend below.
  useEffect(() => {
    if (open) postConfig();
  }, [open, variant, theme, postConfig]);

  // A fresh variant renders a different amount of content, so the previous
  // measurement is stale — drop back to the variant's declared height until
  // the new frame reports in.
  useEffect(() => {
    setMeasuredHeight(null);
  }, [variant, theme]);

  // Size the preview from the widget's own height report.
  useEffect(() => {
    if (!open) return;

    const onMessage = (event: MessageEvent) => {
      // The widget is same-origin with us, so anything claiming otherwise is
      // another frame on the page talking — ignore it rather than letting an
      // unrelated (or hostile) sender drive our layout.
      if (event.origin !== origin) return;
      // The frame just mounted its listener: hand it the current selection,
      // which may already differ from the URL it was loaded with.
      if (isCampaignEmbedReadyMessage(event.data)) {
        postConfig();
        return;
      }
      if (!isCampaignEmbedHeightMessage(event.data)) return;
      // Clamp: a transiently-zero measurement during load would collapse the
      // frame, and an absurd one would blow out the layout.
      setMeasuredHeight(Math.min(Math.max(event.data.height, 160), 2400));
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, origin, postConfig]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: t('noteMoreMenu.toast.embedCopied') });
    } catch {
      toast({
        title: t('campaignsDetail.copyFailed'),
        description: t('campaignsDetail.copyFailedBody'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Rises from the bottom and stops just short of the top, so the page
          behind stays visible as a dismiss affordance. Overrides the sheet
          primitive's default padding and gap; the sections below own their
          own spacing. */}
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] flex-col gap-0 rounded-t-2xl p-0"
      >
        <SheetHeader className="shrink-0 px-5 py-4 pr-14 text-left">
          <SheetTitle className="text-base font-semibold">
            {t('embedCampaign.dialogTitle')}
          </SheetTitle>
          <SheetDescription>{t('embedCampaign.dialogDescription')}</SheetDescription>
        </SheetHeader>

        {/* Controls lead, preview follows. The `full` widget is 900px tall, so
            putting the preview first would push every control off-screen on a
            phone — you'd land on a giant widget with no visible way to change
            it. Stacked, the controls stay in the first viewport and the
            preview is what you scroll to; side-by-side, the same order reads
            left-to-right.

            One scroll container for both columns — giving the preview its own
            `overflow-y-auto` nested a scrollbar inside a scrollbar, so a wheel
            gesture over the widget moved a different surface than the same
            gesture two pixels to the left. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
          {/* Controls. */}
          <div className="shrink-0 space-y-5 px-5 pb-5 pt-5 lg:w-[340px] lg:border-r">
            {/* `type="single"` toggle groups report an empty value when the
                active item is re-clicked; ignoring it keeps one always
                selected. */}
            <div className="space-y-2">
              <Label>{t('embedCampaign.variantLabel')}</Label>
              <ToggleGroup
                type="single"
                value={variant}
                onValueChange={(value) => value && setVariant(value as CampaignEmbedVariant)}
                className="grid grid-cols-3 gap-2"
              >
                {CAMPAIGN_EMBED_VARIANTS.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="rounded-lg border text-sm data-[state=on]:border-primary data-[state=on]:bg-primary/10"
                  >
                    {t(`embedCampaign.variant.${option}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label>{t('embedCampaign.themeLabel')}</Label>
              <ToggleGroup
                type="single"
                value={theme}
                onValueChange={(value) => value && setTheme(value as CampaignEmbedTheme)}
                className="grid grid-cols-3 gap-2"
              >
                {CAMPAIGN_EMBED_THEMES.map((option) => {
                  const Icon = THEME_ICONS[option];
                  return (
                    <ToggleGroupItem
                      key={option}
                      value={option}
                      className="gap-1.5 rounded-lg border data-[state=on]:border-primary data-[state=on]:bg-primary/10"
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate text-sm">{t(THEME_LABEL_KEYS[option])}</span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>

            {/* Snippet — the whole box is the copy affordance. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>{snippetLabel}</Label>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition-colors"
                >
                  {t('embedCampaign.openStandalone')}
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={t('campaignsDetail.copyLabelAction', { label: snippetLabel })}
                className="flex w-full items-start gap-2 rounded-lg border bg-muted/40 p-3 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition-colors"
              >
                <code className="line-clamp-3 min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-muted-foreground">
                  {snippet}
                </code>
                {copied ? (
                  <Check className="size-4 shrink-0 text-green-500" />
                ) : (
                  <Copy className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Preview — just the widget, on the plain page surface, with no
              simulated browser chrome around it. */}
          <div className="flex justify-center lg:flex-1">
            <iframe
              // `frameUrl`, not `previewUrl`: the frame is loaded once and
              // then reconfigured by `postMessage`. Re-keying or re-`src`-ing
              // it on every selection cold-started the whole app inside.
              ref={frameRef}
              src={frameUrl ?? undefined}
              title={iframeTitle}
              allow="clipboard-write"
              className="w-full self-start border-0 motion-safe:transition-[height] motion-safe:duration-200"
              style={{ maxWidth: width, height: measuredHeight ?? fallbackHeight }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
