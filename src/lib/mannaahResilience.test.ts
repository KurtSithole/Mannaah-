import { beforeEach, describe, expect, it } from 'vitest';
import {
  getMannaahRelays,
  getQueuedPublications,
  markPublicationFailed,
  queuePublication,
  removeQueuedPublication,
} from './mannaahResilience';

describe('Mannaah publication resilience', () => {
  beforeEach(() => localStorage.clear());

  it('deduplicates configured relay URLs', () => {
    const original = import.meta.env.VITE_MANNAH_RELAYS;
    import.meta.env.VITE_MANNAH_RELAYS = 'wss://one.example, wss://two.example, wss://one.example';
    expect(getMannaahRelays()).toEqual(['wss://one.example', 'wss://two.example']);
    import.meta.env.VITE_MANNAH_RELAYS = original;
  });

  it('queues only the bounded public publication record', () => {
    for (let i = 0; i < 30; i += 1) queuePublication({ id: i, kind: 33863, content: 'public' });
    const queue = getQueuedPublications();
    expect(queue).toHaveLength(25);
    expect(queue[0].event).toMatchObject({ id: 5, kind: 33863 });
  });

  it('tracks failed publication attempts and supports removal', () => {
    const item = queuePublication({ kind: 33863, content: 'public' });
    markPublicationFailed(item.id, 'relay unavailable');
    expect(getQueuedPublications()[0]).toMatchObject({ attempts: 1, lastError: 'relay unavailable' });
    removeQueuedPublication(item.id);
    expect(getQueuedPublications()).toEqual([]);
  });
});
