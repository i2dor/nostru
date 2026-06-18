import { describe, it, expect, vi } from 'vitest';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { buildZapRequest } from './zap';

const mockSign = vi.fn().mockResolvedValue(undefined);
const mockRawEvent = vi.fn(() => ({
  kind: 9734,
  content: '',
  tags: [],
  created_at: 1700000000,
  pubkey: 'aabbcc',
  id: 'ddee',
  sig: 'ff00',
}));

vi.mock('@nostr-dev-kit/ndk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nostr-dev-kit/ndk')>();
  return {
    ...actual,
    NDKEvent: vi.fn().mockImplementation((_ndk: unknown, template: unknown) => ({
      ...(template as object),
      sign: mockSign,
      rawEvent: mockRawEvent,
    })),
  };
});

const fakeNdk = {} as Parameters<typeof buildZapRequest>[0];

const BASE_PARAMS = {
  recipientPubkey: 'deadbeef',
  lnurl: 'lnurl1...',
  amountMsats: 21_000,
  relayUrls: ['wss://relay.damus.io', 'wss://nos.lol'],
};

function lastCallTemplate<T>(): T {
  const call = vi.mocked(NDKEvent).mock.calls.at(-1) as unknown as [unknown, T];
  return call[1];
}

describe('buildZapRequest', () => {
  it('produces kind 9734 JSON', async () => {
    const raw = await buildZapRequest(fakeNdk, BASE_PARAMS);
    const ev = JSON.parse(raw) as { kind: number };
    expect(ev.kind).toBe(9734);
  });

  it('passes correct tags to NDKEvent', async () => {
    await buildZapRequest(fakeNdk, BASE_PARAMS);
    const { tags } = lastCallTemplate<{ tags: string[][] }>();
    expect(tags.find(t => t[0] === 'p')?.[1]).toBe('deadbeef');
    expect(tags.find(t => t[0] === 'amount')?.[1]).toBe('21000');
    expect(tags.find(t => t[0] === 'lnurl')?.[1]).toBe('lnurl1...');
    expect(tags.find(t => t[0] === 'relays')?.slice(1)).toEqual(['wss://relay.damus.io', 'wss://nos.lol']);
  });

  it('includes e tag when noteId provided', async () => {
    await buildZapRequest(fakeNdk, { ...BASE_PARAMS, noteId: 'noteid123' });
    const { tags } = lastCallTemplate<{ tags: string[][] }>();
    expect(tags.find(t => t[0] === 'e')?.[1]).toBe('noteid123');
  });

  it('omits e tag when no noteId', async () => {
    await buildZapRequest(fakeNdk, BASE_PARAMS);
    const { tags } = lastCallTemplate<{ tags: string[][] }>();
    expect(tags.find(t => t[0] === 'e')).toBeUndefined();
  });

  it('puts comment in content', async () => {
    await buildZapRequest(fakeNdk, { ...BASE_PARAMS, comment: 'great post' });
    const { content } = lastCallTemplate<{ content: string }>();
    expect(content).toBe('great post');
  });

  it('signs the event', async () => {
    await buildZapRequest(fakeNdk, BASE_PARAMS);
    expect(mockSign).toHaveBeenCalled();
  });
});
