/** Mannaah production resilience primitives.
 *
 * Public Nostr campaign events are replicated by relays, so the client should
 * prefer multiple healthy relays and keep failed publications retryable.
 * This module intentionally stores only unsigned/public event payloads in the
 * browser queue; private keys and payment secrets are never persisted here.
 */

export type MannaahRelayStatus = 'healthy' | 'degraded' | 'offline';

export interface MannaahRelayHealth {
  url: string;
  status: MannaahRelayStatus;
  latencyMs?: number;
  checkedAt: number;
  error?: string;
}

export interface MannaahQueuedPublication {
  id: string;
  event: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const QUEUE_KEY = 'mannaah:publication-queue:v1';
const DEFAULT_TIMEOUT_MS = 4500;

export function getMannaahRelays(): string[] {
  const configured = import.meta.env.VITE_MANNAH_RELAYS as string | undefined;
  const relays = (configured ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  return [...new Set(relays)];
}

export function getQueuedPublications(): MannaahQueuedPublication[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as MannaahQueuedPublication[] : [];
  } catch {
    return [];
  }
}

export function queuePublication(event: Record<string, unknown>): MannaahQueuedPublication {
  const item: MannaahQueuedPublication = {
    id: crypto.randomUUID(),
    event,
    createdAt: Date.now(),
    attempts: 0,
  };
  const queue = getQueuedPublications();
  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-25)));
  return item;
}

export function removeQueuedPublication(id: string): void {
  const queue = getQueuedPublications().filter((item) => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function markPublicationFailed(id: string, error: string): void {
  const queue = getQueuedPublications().map((item) => item.id === id
    ? { ...item, attempts: item.attempts + 1, lastError: error }
    : item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function probeRelay(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<MannaahRelayHealth> {
  const started = performance.now();
  const checkedAt = Date.now();
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    // WebSocket handshake is the meaningful availability test for a Nostr relay.
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        try { socket.close(); } catch { /* noop */ }
        fn();
      };
      socket.onopen = () => finish(resolve);
      socket.onerror = () => finish(() => reject(new Error('relay connection failed')));
      controller.signal.addEventListener('abort', () => finish(() => reject(new Error('relay timeout'))), { once: true });
    });
    return { url, status: 'healthy', latencyMs: Math.round(performance.now() - started), checkedAt };
  } catch (error) {
    return { url, status: 'offline', latencyMs: Math.round(performance.now() - started), checkedAt, error: error instanceof Error ? error.message : 'relay unavailable' };
  }
}

export async function checkMannaahRelays(relays = getMannaahRelays()): Promise<MannaahRelayHealth[]> {
  if (relays.length === 0) return [];
  const results = await Promise.all(relays.map((relay) => probeRelay(relay)));
  return results.sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity));
}
