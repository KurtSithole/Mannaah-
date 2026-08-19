import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, CloudOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { checkMannaahRelays, getMannaahRelays, getQueuedPublications, type MannaahRelayHealth } from '@/lib/mannaahResilience';


export function MannaahNetworkPage() {
useSeoMeta({ title: 'Network Resilience | Mannaah', description: 'Mannaah relay health and publication resilience.' });
  const [relays, setRelays] = useState<MannaahRelayHealth[]>([]);
  const [checking, setChecking] = useState(false);
  const [queueSize, setQueueSize] = useState(getQueuedPublications().length);

  const check = async () => {
    setChecking(true);
    try { setRelays(await checkMannaahRelays()); }
    finally { setQueueSize(getQueuedPublications().length); setChecking(false); }
  };

  useEffect(() => { void check(); }, []);
  const configured = getMannaahRelays();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a765e]">Mannaah</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#3f4d42]">Network resilience</h1>
        <p className="mt-3 text-muted-foreground">Mannaah is designed so a single unavailable relay does not have to become a single point of failure.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5" /> Relay health</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {configured.length === 0 && <p className="text-sm text-muted-foreground">No dedicated Mannaah relays are configured yet. The application will continue using Agora's configured relay infrastructure.</p>}
          {relays.map((relay) => (
            <div key={relay.url} className="flex items-center justify-between rounded-xl border p-4">
              <div className="min-w-0"><p className="truncate font-medium">{relay.url}</p><p className="text-xs text-muted-foreground">{relay.latencyMs != null ? `${relay.latencyMs} ms` : 'No response time'} · checked {new Date(relay.checkedAt).toLocaleTimeString()}</p></div>
              {relay.status === 'healthy' ? <CheckCircle2 className="size-5 text-primary" /> : <CloudOff className="size-5 text-muted-foreground" />}
            </div>
          ))}
          <Button variant="outline" onClick={() => void check()} disabled={checking} className="w-full"><RefreshCw className={`mr-2 size-4 ${checking ? 'animate-spin' : ''}`} />{checking ? 'Checking relays…' : 'Check again'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> Publication resilience</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Campaign events should be published to more than one healthy relay whenever dedicated Mannaah relays are configured.</p>
          <p>{queueSize > 0 ? `${queueSize} publication${queueSize === 1 ? '' : 's'} currently waiting for retry.` : 'No locally queued failed publications.'}</p>
          <p>Only public event payloads belong in this retry queue. Private keys, wallet seeds and payment credentials must never be stored here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default MannaahNetworkPage;
