import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { nip19 } from 'nostr-tools';
import type { AddressPointer } from 'nostr-tools/nip19';

import { CampaignCard, CampaignCardSkeleton } from '@/components/CampaignCard';
import { CampaignEmbedWidget } from '@/components/CampaignEmbedWidget';
import { useCampaign } from '@/hooks/useCampaign';
import { CAMPAIGN_KIND } from '@/lib/campaign';
import {
  CAMPAIGN_EMBED_HEIGHT_MESSAGE,
  CAMPAIGN_EMBED_READY_MESSAGE,
  CAMPAIGN_EMBED_SIZES,
  type CampaignEmbedTheme,
  type CampaignEmbedVariant,
  isCampaignEmbedConfigMessage,
  parseCampaignEmbedTheme,
  parseCampaignEmbedVariant,
} from '@/lib/campaignEmbed';

/**
 * Standalone, chrome-less campaign widget for third-party embedding.
 *
 * Rendered at `/embed/campaign/:nip19` (an `naddr1…` pointing at a kind
 * {@link CAMPAIGN_KIND} event) *outside* the app's `FundraiserLayout`, so it
 * ships no top nav, footer, or side rails — just the widget a host site drops
 * into an `<iframe>`. Snippets are produced by the "Embed widget" action in a
 * campaign's overflow menu, which previews these same URLs live.
 *
 * Two query parameters shape the render, both tolerant of garbage (unknown
 * values fall back to the default, so a hand-edited snippet degrades instead
 * of breaking):
 *
 * - `variant` — `card` (default), `donate`, or `full`. See
 *   {@link CampaignEmbedVariant}. `card` is the default because it was the
 *   only widget that existed before variants, so snippets pasted back then
 *   keep rendering exactly what their embedder chose.
 * - `theme` — `auto` (default), `light`, or `dark`.
 *
 * The widget also posts its content height to the parent window
 * ({@link CAMPAIGN_EMBED_HEIGHT_MESSAGE}) so a host-side loader — or Agora's
 * own preview in the embed builder — can size the frame to fit.
 */
export function EmbedCampaignPage() {
  const { t } = useTranslation();
  const { nip19: identifier } = useParams<{ nip19: string }>();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  // Seeded from the URL — which is all a real embed ever provides — but held
  // as state so the builder's preview can retarget a live frame instead of
  // reloading it. See {@link useEmbedConfigMessages}.
  const [variant, setVariant] = useState<CampaignEmbedVariant>(() =>
    parseCampaignEmbedVariant(searchParams.get('variant')),
  );
  const [theme, setTheme] = useState<CampaignEmbedTheme>(() =>
    parseCampaignEmbedTheme(searchParams.get('theme')),
  );

  useEmbedConfigMessages(setVariant, setTheme);
  useEmbedTheme(theme);

  const addr = useMemo<AddressPointer | null>(() => {
    if (!identifier) return null;
    try {
      const decoded = nip19.decode(identifier);
      if (decoded.type !== 'naddr') return null;
      const data = decoded.data as AddressPointer;
      if (data.kind !== CAMPAIGN_KIND) return null;
      return data;
    } catch {
      return null;
    }
  }, [identifier]);

  const { data: campaign, isLoading } = useCampaign({
    pubkey: addr?.pubkey ?? '',
    identifier: addr?.identifier ?? '',
    relays: addr?.relays,
  });

  // Report content height to a host-side embed loader so it can size the
  // iframe to fit. Runs regardless of whether a parent is listening.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const post = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      window.parent?.postMessage({ type: CAMPAIGN_EMBED_HEIGHT_MESSAGE, height }, '*');
    };

    const observer = new ResizeObserver(post);
    observer.observe(el);
    post();
    return () => observer.disconnect();
  }, [campaign, variant]);

  // Intercept the *card* variant's internal navigation and open the campaign
  // on Agora in a new top-level tab, so a click inside the iframe doesn't
  // replace the widget with a client-side route render.
  //
  // This is deliberately scoped to `card` alone. The handler blanket-calls
  // `preventDefault()` on everything beneath it, which is correct for a card
  // (the whole surface is one big `<Link>`) but would silently kill every
  // button in the payment-capable variants — copy, card hand-off,
  // external wallet. Those variants ship their own `target="_blank"` links
  // and need no interception at all.
  const handleOpenInNewTab = (e: React.MouseEvent) => {
    if (!identifier) return;
    e.preventDefault();
    const url = new URL(`/${identifier}`, window.location.origin).toString();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const notFound = (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {t('embedCampaign.notFound')}
    </div>
  );

  return (
    // No page wrapper: the widget *is* the document. A padded, full-height
    // shell around it just inset the widget from an invisible frame edge and
    // added height the host had to scroll past.
    <div
      ref={containerRef}
      className="mx-auto w-full"
      style={{ maxWidth: CAMPAIGN_EMBED_SIZES[variant].width }}
    >
      {addr === null ? (
        notFound
      ) : isLoading && !campaign ? (
        <CampaignCardSkeleton variant="compact" />
      ) : !campaign ? (
        notFound
      ) : variant === 'card' ? (
        <div onClickCapture={handleOpenInNewTab}>
          <CampaignCard campaign={campaign} variant="compact" showModerationMenu={false} />
        </div>
      ) : (
        <CampaignEmbedWidget campaign={campaign} variant={variant} />
      )}
    </div>
  );
}

/**
 * Lets a same-origin parent retarget this widget in place.
 *
 * Only Agora's own embed builder is on the other end. Its preview used to be
 * keyed on the widget URL, so every variant or theme click threw away a
 * running app and cold-started another one — new bundle evaluation, new relay
 * sockets, a fresh campaign query and balance lookup — for a change that is
 * really just a re-render. Now the frame loads once and the builder tells it
 * what to show.
 *
 * Two guards keep this from being an opening. `event.origin` must be our own
 * origin, so on a partner's site their page can't drive the widget (a real
 * embed picks its variant in the URL, where the embedder can see it). And
 * `event.source` must be the actual parent window, so a sibling frame that
 * happens to be same-origin can't reach in either.
 */
function useEmbedConfigMessages(
  setVariant: (variant: CampaignEmbedVariant) => void,
  setTheme: (theme: CampaignEmbedTheme) => void,
) {
  useEffect(() => {
    const parent = window.parent;
    if (!parent || parent === window) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== parent) return;
      if (!isCampaignEmbedConfigMessage(event.data)) return;
      setVariant(event.data.variant);
      setTheme(event.data.theme);
    };

    window.addEventListener('message', onMessage);
    // Announce only after the listener exists, so the builder's reply can't
    // arrive before we can hear it.
    parent.postMessage({ type: CAMPAIGN_EMBED_READY_MESSAGE }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, [setVariant, setTheme]);
}

/**
 * Pins the widget's color scheme to the embedder's choice.
 *
 * A widget can't see its host page's theme, and inside a cross-origin iframe
 * `localStorage` is partitioned per embedding site — so the app's stored
 * preference is meaningless here (it belongs to the partner's origin, where
 * the visitor has never set it). The embedder decides instead, and `auto`
 * follows the visitor's own OS preference.
 *
 * Mechanically this mirrors `AppProvider`'s `useApplyTheme`: flip the class on
 * `<html>` and let the static `:root` / `.dark` blocks in `index.css` win. A
 * passive effect is used *on purpose* — `AppProvider` applies the stored theme
 * in a layout effect, and layout effects of a parent run after those of its
 * children, so a layout effect here would be immediately clobbered. Passive
 * effects run later still, so this one lands last. `public/theme.js` handles
 * the pre-React paint, so there's no visible flash in between.
 */
function useEmbedTheme(theme: CampaignEmbedTheme) {
  useEffect(() => {
    const apply = () => {
      const resolved = theme === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.className = resolved;
      // Match the app: drop the inline background `public/theme.js` painted
      // before React mounted, so `bg-transparent` can let the host page show
      // through behind the widget.
      document.body.removeAttribute('style');
    };

    apply();

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);
}

export default EmbedCampaignPage;
