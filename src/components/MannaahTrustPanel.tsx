import type { ReactNode } from 'react';
import { CheckCircle2, CircleHelp, ShieldCheck, WalletCards } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CampaignVerificationBadge } from '@/components/CampaignVerificationBadge';
import { useCampaignTrustedVerification } from '@/hooks/useCampaignTrustedVerification';
import { useCampaignVerifications } from '@/hooks/useCampaignVerifications';
import { parseCampaignWallet } from '@/lib/campaign';
import type { ParsedCampaign } from '@/lib/campaign';
import { cn } from '@/lib/utils';

interface TrustRowProps {
  title: string;
  description: string;
  state: 'positive' | 'neutral';
  icon: ReactNode;
}

function TrustRow({ title, description, state, icon }: TrustRowProps) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-background/50 p-3">
      <div className={cn('mt-0.5 shrink-0', state === 'positive' ? 'text-emerald-600' : 'text-muted-foreground')}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * Mannaah's human-readable trust surface. It deliberately separates facts
 * that can be established cryptographically/payment-wise from claims that
 * require human review. No "Mannaah verified" claim is shown unless a
 * dedicated Mannaah review signal exists in the protocol.
 */
export function MannaahTrustPanel({ campaign }: { campaign: ParsedCampaign }) {
  const { data: verificationData } = useCampaignVerifications();
  const { isTrustedVerified, isLoading } = useCampaignTrustedVerification(campaign.aTag);
  const verifications = verificationData.byCoord.get(campaign.aTag) ?? [];
  const walletValues = [campaign.wallets.onchain?.value, campaign.wallets.sp?.value].filter(Boolean) as string[];
  const validWallets = walletValues.filter((value) => !!parseCampaignWallet(value)).length;

  const publicHistory = campaign.event.created_at > 0;

  return (
    <Card className="overflow-hidden border-primary/15 bg-card/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-primary" />
              Mannaah trust & safety
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              A transparent view of what can be checked about this campaign — and what cannot.
            </p>
          </div>
          {!isLoading && isTrustedVerified ? (
            <CampaignVerificationBadge coord={campaign.aTag} title={campaign.title} variant="inline" />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <TrustRow
          title="Payment destination checked"
          description={validWallets > 0
            ? `${validWallets} declared Bitcoin payment destination${validWallets === 1 ? '' : 's'} uses a format recognised by Mannaah's campaign protocol.`
            : 'No recognised payment destination is currently available.'}
          state={validWallets > 0 ? 'positive' : 'neutral'}
          icon={<WalletCards className="size-5" />}
        />

        <TrustRow
          title="Campaign identity is cryptographically signed"
          description="This campaign is published as a signed Nostr event. That establishes control of the publishing key; it does not by itself prove the story or circumstances described."
          state="positive"
          icon={<CheckCircle2 className="size-5" />}
        />

        <TrustRow
          title={verifications.length > 0 ? `${verifications.length} community verification${verifications.length === 1 ? '' : 's'}` : 'No community verification yet'}
          description={verifications.length > 0
            ? 'Each verifier is shown so donors can make their own judgement about the people vouching for this campaign.'
            : 'No independent verification labels are currently visible for this campaign.'}
          state={verifications.length > 0 ? 'positive' : 'neutral'}
          icon={verifications.length > 0 ? <CheckCircle2 className="size-5" /> : <CircleHelp className="size-5" />}
        />

        <TrustRow
          title="Mannaah review"
          description="A community verification is not the same as a Mannaah investigation. This campaign is not being presented as independently fact-checked unless a future Mannaah review record says so."
          state="neutral"
          icon={<CircleHelp className="size-5" />}
        />

        <TrustRow
          title="Public campaign history"
          description={publicHistory
            ? 'The campaign has a signed creation event and can accumulate public updates and activity over time. Public Nostr records may be replicated by other relays.'
            : 'Campaign history is not currently available.'}
          state={publicHistory ? 'positive' : 'neutral'}
          icon={publicHistory ? <CheckCircle2 className="size-5" /> : <CircleHelp className="size-5" />}
        />

        <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          <strong className="text-foreground">Before donating:</strong> read the story, inspect the trust signals, verify the payment destination in your own wallet, and only give what you can afford to lose.
        </div>
      </CardContent>
    </Card>
  );
}
