import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { CheckCircle2, KeyRound, ShieldCheck, Smartphone, ExternalLink, AlertTriangle, Copy, Check } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { useNostrLogin } from '@nostrify/react/login';

import { useAppContext } from '@/hooks/useAppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';

const BACKUP_ACK_KEY = 'mannaah:identity-recovery-ack:v1';

export function MannaahIdentityPage() {
  const { config } = useAppContext();
  const { logins } = useNostrLogin();
  const { toast } = useToast();
  const current = logins[0];
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  useSeoMeta({
    title: `Identity & Recovery | ${config.appName}`,
    description: 'Manage your Mannaah cryptographic identity, signer and recovery plan.',
  });

  useEffect(() => {
    try {
      setAcknowledged(localStorage.getItem(BACKUP_ACK_KEY) === 'true');
    } catch {
      setAcknowledged(false);
    }
  }, []);

  const identity = useMemo(() => {
    if (!current) return null;
    return {
      npub: nip19.npubEncode(current.pubkey),
      type: current.type,
    };
  }, [current]);

  const markAcknowledged = () => {
    try {
      localStorage.setItem(BACKUP_ACK_KEY, 'true');
      setAcknowledged(true);
      toast({ title: 'Recovery plan saved', description: 'This reminder is stored only on this device.' });
    } catch {
      toast({ title: 'Could not save locally', description: 'Your recovery plan was not stored on this device.', variant: 'destructive' });
    }
  };

  const copyNpub = async () => {
    if (!identity) return;
    try {
      await navigator.clipboard.writeText(identity.npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast({ title: 'Copy failed', description: 'Please select and copy your npub manually.', variant: 'destructive' });
    }
  };

  if (!current || !identity) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Card>
          <CardHeader><CardTitle>Your Mannaah identity</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>You are not currently signed in. Sign in with a Nostr identity before opening the recovery centre.</p>
            <Button asChild><Link to="/">Return home</Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isNsec = current.type === 'nsec';
  const isBunker = current.type === 'bunker';
  const isExtension = current.type === 'extension';

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12 space-y-6">
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-primary"><ShieldCheck className="size-5" /><span className="text-sm font-medium">Mannaah Identity Centre</span></div>
        <h1 className="text-3xl font-semibold tracking-tight">Keep control of your identity.</h1>
        <p className="text-muted-foreground leading-relaxed">Your Nostr identity signs your public activity and campaigns. Mannaah should never become the custodian of the secret key behind it.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Current identity</span>
            <Badge variant="secondary">{current.type === 'nsec' ? 'Local key' : current.type === 'bunker' ? 'NIP-46 signer' : 'External signer'}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Public identity (npub)</div>
            <div className="break-all font-mono text-xs leading-relaxed">{identity.npub}</div>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={copyNpub}>
              {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
              {copied ? 'Copied' : 'Copy npub'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Your npub can be shared publicly. Your secret key (nsec) must never be shared.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-5" />Signer & recovery</CardTitle></CardHeader>
        <CardContent className="space-y-5 text-sm">
          {isNsec && (
            <div className="space-y-3">
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div><strong>Local secret-key login.</strong><p className="mt-1 text-muted-foreground">Your login depends on the secret key. If you lose it, Mannaah cannot recover the original Nostr identity for you.</p></div>
              </div>
              <p className="text-muted-foreground">Use the existing secure backup controls in Profile Settings. On native builds, Agora's secure-storage adapter uses the platform secure storage; web storage remains subject to the security of the browser/device.</p>
              <Button asChild variant="outline"><Link to="/settings/profile"><KeyRound className="mr-2 size-4" />Open key backup</Link></Button>
            </div>
          )}

          {isBunker && (
            <div className="space-y-3">
              <div className="flex gap-3 rounded-xl border p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><strong>Your secret key stays with the remote signer.</strong><p className="mt-1 text-muted-foreground">Mannaah uses the NIP-46 signer to request signatures without importing the user's secret key into the application.</p></div></div>
              <p className="text-muted-foreground">This is the preferred model for users who want the application and signing key kept separate. Keep access to your signer and its recovery method independently of Mannaah.</p>
              <Button asChild variant="outline"><Link to="/settings/profile"><ExternalLink className="mr-2 size-4" />Review signer settings</Link></Button>
            </div>
          )}

          {isExtension && (
            <div className="space-y-3">
              <div className="flex gap-3 rounded-xl border p-4"><Smartphone className="mt-0.5 size-5 shrink-0 text-primary" /><div><strong>Your external signer holds the secret key.</strong><p className="mt-1 text-muted-foreground">Mannaah requests signatures from the signer instead of storing the secret key in the app.</p></div></div>
              <p className="text-muted-foreground">Back up the identity using the recovery mechanism provided by your signer. Do not paste the secret key into Mannaah just to make recovery easier.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Campaign ownership & key changes</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>A Nostr public key is the identity that signs your campaigns. Creating a replacement key creates a new identity; it does not automatically transfer ownership of existing campaigns.</p>
          <p>Mannaah therefore does <strong>not</strong> present an untested “rotate identity” button as if it could safely transfer campaign ownership. A future recovery/transfer protocol must explicitly define how old and new identities are linked and how donors can verify that relationship.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recovery checklist</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-primary" />Know which signer controls your identity.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-primary" />Have a recovery method stored separately from your everyday device.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-primary" />Keep your secret key private and never send it to Mannaah support.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-primary" />Keep your campaign Bitcoin/Lightning wallet recovery separate from your Nostr identity recovery.</li>
          </ul>
          <Button type="button" onClick={markAcknowledged} variant={acknowledged ? 'secondary' : 'default'}>
            {acknowledged ? <><Check className="mr-2 size-4" />Recovery plan acknowledged</> : 'I have a recovery plan'}
          </Button>
          {acknowledged && <p className="text-xs text-muted-foreground">This acknowledgement is stored locally on this device. It is not published to Nostr.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
