import { useMemo, useState } from 'react';
import { Copy, Heart, Share2, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeCanvas } from '@/components/ui/qrcode';
import { useToast } from '@/hooks/useToast';

const PRESETS = [10, 25, 50, 100, 250];

function configuredAddress(): string | undefined {
  const value = import.meta.env.VITE_MANNAH_SUPPORT_BTC_ADDRESS as string | undefined;
  return value?.trim() || undefined;
}

export function MannaahSupportPage() {
  const { toast } = useToast();
  const [amount, setAmount] = useState('25');
  const [copied, setCopied] = useState(false);
  const address = configuredAddress();
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const amountNumber = Number(amount.replace(/[, $]/g, ''));
  const bitcoinUri = useMemo(() => {
    if (!address) return '';
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return `bitcoin:${address}`;
    return `bitcoin:${address}?amount=${(amountNumber / 100_000_000).toFixed(8)}`;
  }, [address, amountNumber]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: `Couldn't copy ${label.toLowerCase()}`, variant: 'destructive' });
    }
  };

  const share = async () => {
    const text = "Help doesn't ask where you're from — support Mannaah.";
    if (navigator.share) {
      await navigator.share({ title: 'Mannaah', text, url: shareUrl });
      return;
    }
    await copy(shareUrl, 'Mannaah link');
  };

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-background">
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
        <div className="text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Heart className="size-7 text-primary" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-primary">SUPPORT MANNAH</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Help doesn't ask where you're from.</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Your support helps Mannaah keep the platform open, resilient and available to people who need direct assistance.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Support Mannaah with Bitcoin</h2>
            <p className="mt-2 text-sm text-muted-foreground">Choose an amount, then pay directly to Mannaah's configured support address.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {PRESETS.map((value) => (
                <Button key={value} type="button" variant={amount === String(value) ? 'default' : 'outline'} size="sm" onClick={() => setAmount(String(value))}>
                  ${value}
                </Button>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <Label htmlFor="mannaah-custom">Custom amount (USD)</Label>
              <Input id="mannaah-custom" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" />
            </div>

            {address ? (
              <div className="mt-6 space-y-4">
                <div className="mx-auto w-fit rounded-xl bg-white p-3">
                  <QRCodeCanvas value={bitcoinUri} size={220} level="H" />
                </div>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-3 text-left" onClick={() => copy(bitcoinUri, 'Bitcoin payment link')}>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{bitcoinUri}</span>
                  {copied ? <Check className="size-4 shrink-0 text-primary" /> : <Copy className="size-4 shrink-0 text-muted-foreground" />}
                </button>
                <Button asChild className="w-full"><a href={bitcoinUri}><ExternalLink className="mr-2 size-4" />Open in wallet</a></Button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Bitcoin support is not enabled yet. Configure <code>VITE_MANNAH_SUPPORT_BTC_ADDRESS</code> before deployment; Mannaah will never pretend a production treasury exists when one has not been configured.
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Share Mannaah</h2>
            <p className="mt-2 text-sm text-muted-foreground">You can help without spending anything. Sharing Mannaah can connect someone in need with someone able to help.</p>
            <Button className="mt-6 w-full" size="lg" onClick={() => void share()}><Share2 className="mr-2 size-5" />Share Mannaah</Button>
            <div className="mt-4 rounded-xl bg-primary/5 p-4 text-sm leading-6">
              <strong>You don't have to walk alone.</strong><br />A simple share can be the bridge between a person asking for help and a person ready to give it.
            </div>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="ghost"><Link to="/campaigns">Browse campaigns</Link></Button>
        </div>
      </section>
    </main>
  );
}

export default MannaahSupportPage;
