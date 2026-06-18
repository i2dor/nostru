import { describe, it, expect } from 'vitest';
import { finalizeEvent, verifyEvent, generateSecretKey, getPublicKey, type Event } from 'nostr-tools';

describe('Nostr event id and signature', () => {
  it('finalizeEvent computes a valid id and signature', () => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const event = finalizeEvent(
      { kind: 1, content: 'hello nostr', tags: [], created_at: 1700000000 },
      sk,
    );
    expect(event.pubkey).toBe(pk);
    expect(event.id).toMatch(/^[0-9a-f]{64}$/);
    expect(event.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifyEvent(event)).toBe(true);
  });

  it('verifyEvent rejects a tampered event', () => {
    const sk = generateSecretKey();
    const event = finalizeEvent(
      { kind: 1, content: 'original', tags: [], created_at: 1700000000 },
      sk,
    );
    const base = Object.fromEntries(Object.entries(event)) as unknown as Event;
    const tampered: Event = { ...base, content: 'tampered' };
    expect(verifyEvent(tampered)).toBe(false);
  });
});
