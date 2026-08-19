import { useTranslation } from 'react-i18next';
import { CreditCard, ExternalLink, HandHeart } from 'lucide-react';

import { CampaignPrivateNotice, CampaignRaised } from '@/components/CampaignCard';
import { CampaignVerificationBadge } from '@/components/CampaignVerificationBadge';
import { CampaignWalletDonatePanel } from '@/components/CampaignWalletDonatePanel';
import { InlineMarkdown } from '@/components/InlineMarkdown';
import { ProxiedImage } from '@/components/ProxiedImage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuthor } from '@/hooks/useAuthor';
import { useBtcPrice } from '@/hooks/useBtcPrice';
import { useCampaignDonations } from '@/hooks/useCampaignDonations';
import { useCampaignUrl } from '@/hooks/useCampaignUrl';
import type { ParsedCampaign } from '@/lib/campaign';
import { genUserName } from '@/lib/genUserName';
import { sanitizeUrl } from '@/lib/sanitizeUrl';
import { cn } from '@/lib/utils';

interface CampaignEmbedWidgetProps {
  campaign: ParsedCampaign;
  /**
   * - `donate` — pay-only: just enough campaign identity to make the QR
   *   trustworthy, then the payment stack.
   * - `full` — banner, story, and progress above the payment stack.
   */
  variant: 'donate' | 'full';
}

/**
 * The payment-capable campaign widgets.
 *
 * Both variants end in the same stack — QR, copyable BIP-21 URI, optional
 * card hand-off, external-wallet hand-off — so a donor can pay from the
 * host page without ever visiting Agora. That's the whole point: the
 * original `card` widget could only ever bounce a donor to another site,
 * which is where donations go to die.
 *
 * Everything here is embed-safe by construction:
 *
 * - **No in-app payment.** Nothing touches `useHdWalletAccess`,
 *   `useBitcoinSigner`, or `DonateDialog`. Those read the raw `nsec` out of
 *   storage, and deriving a wallet seed inside a frame a third party controls
 *   is precisely the key-theft scenario the security model forbids. There is
 *   also no login here to derive from — storage is partitioned per embedding
 *   site — so the in-app path would be dead weight even if it were safe.
 * - **No modals.** A Radix dialog inside a 380x660 frame is unusable, so the
 *   "Don't have Bitcoin?" on-ramp list stays on Agora and donors reach it
 *   through the footer link.
 * - **Every outbound link opens a new top-level context.** An in-frame
 *   navigation would silently replace the widget with a full Agora page
 *   rendered inside someone's sidebar.
 */
export function CampaignEmbedWidget({ campaign, variant }: CampaignEmbedWidgetProps) {
  const { t } = useTranslation();
  // Widgets show the raised total but never the donor list, so we skip the
  // kind 8333 receipt fetch and its per-receipt `/tx` verification fan-out and
  // keep this to a single Esplora balance lookup. Unlike a card in a grid
  // there's no `enabled: inView` gate — a widget is the only thing in its
  // frame, so it is on screen by definition.
  const { data: stats, isLoading: donationsLoading } = useCampaignDonations(campaign, {
    receipts: false,
  });
  const { data: btcPrice } = useBtcPrice();
  const campaignPath = useCampaignUrl(campaign);
  const author = useAuthor(campaign.pubkey);
  const authorMetadata = author.data?.metadata;

  const campaignHref = new URL(campaignPath, window.location.origin).toString();
  const payUrl = sanitizeUrl(campaign.payUrl);
  const raisedSats = stats?.totalSats ?? 0;
  // SP-only campaigns have no observable on-chain total by design.
  const isSilentPayment = !campaign.wallets.onchain;
  const isFull = variant === 'full';

  const cover = isFull
    ? sanitizeUrl(campaign.banner)
      ?? sanitizeUrl(authorMetadata?.banner)
      ?? sanitizeUrl(authorMetadata?.picture)
    : undefined;

  const progress = isSilentPayment ? (
    <CampaignPrivateNotice goalUsd={campaign.goalUsd} />
  ) : (
    <CampaignRaised
      raisedSats={raisedSats}
      goalUsd={campaign.goalUsd}
      btcPrice={btcPrice}
      hasSp={!!campaign.wallets.sp}
      isLoading={donationsLoading}
    />
  );

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      {isFull && (
        <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-primary/15 via-primary/5 to-secondary">
          {cover ? (
            <ProxiedImage
              src={cover}
              width={600}
              gated
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <HandHeart className="size-12 text-primary" />
            </div>
          )}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent"
          />
          <CampaignVerificationBadge
            coord={campaign.aTag}
            title={campaign.title}
            className="absolute left-3 top-3 z-10"
          />
        </div>
      )}

      <div className={cn('flex flex-col gap-4', isFull ? 'p-5' : 'p-4')}>
        {/* Campaign identity. A donor must always be able to see *what* they
            are about to pay — an unlabeled QR code is indistinguishable from
            an address-swap scam — so the title is present in both variants,
            not just the one with the banner. */}
        <div className="space-y-1">
          <h2
            className={cn(
              'font-bold leading-tight tracking-tight',
              isFull ? 'text-xl' : 'text-base',
            )}
          >
            <a
              href={campaignHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition-colors"
            >
              {campaign.title}
            </a>
          </h2>
          {isFull && campaign.story.trim() && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              <InlineMarkdown>{campaign.story}</InlineMarkdown>
            </p>
          )}
        </div>

        {progress}

        <CampaignWalletDonatePanel
          wallets={campaign.wallets}
          lightning={campaign.lightning}
          openInNewTab
          secondaryAction={
            payUrl ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-green-600/40 bg-green-600 text-white hover:bg-green-700 hover:text-white dark:border-green-500/40"
              >
                <a href={payUrl} target="_blank" rel="noopener noreferrer">
                  <CreditCard className="mr-2 size-5" />
                  {t('campaignsDetail.payWithCard')}
                </a>
              </Button>
            ) : undefined
          }
        />

        {/* Footer — attribution plus the escape hatch to the full campaign,
            which is also where the on-ramp list and the donor feed live. */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {authorMetadata?.name || genUserName(campaign.pubkey)}
          </span>
          <a
            href={campaignHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition-colors"
          >
            {t('embedCampaign.viewOnAgora')}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </Card>
  );
}
