import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';

vi.mock('@nostr-dev-kit/ndk');

import { publishDeletion } from './publish';

type FakeEvent = {
  kind: number;
  content: string;
  tags: string[][];
  sign: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
};

function makeNdk(): NDK { return {} as NDK; }

describe('publishDeletion', () => {
  let signMock: ReturnType<typeof vi.fn>;
  let publishMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signMock = vi.fn().mockResolvedValue(undefined);
    publishMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(NDKEvent).mockClear();
    vi.mocked(NDKEvent).mockImplementation(() => ({
      kind: 0,
      content: '',
      tags: [] as string[][],
      sign: signMock,
      publish: publishMock,
    }) as unknown as NDKEvent);
  });

  it('publishes kind 5', async () => {
    await publishDeletion(makeNdk(), 'abc123', 1);
    const ev = vi.mocked(NDKEvent).mock.results[0].value as FakeEvent;
    expect(ev.kind).toBe(5);
  });

  it('sets e tag to the target event id', async () => {
    await publishDeletion(makeNdk(), 'abc123', 1);
    const ev = vi.mocked(NDKEvent).mock.results[0].value as FakeEvent;
    expect(ev.tags).toContainEqual(['e', 'abc123']);
  });

  it('sets k tag to the stringified event kind', async () => {
    await publishDeletion(makeNdk(), 'abc123', 1);
    const ev = vi.mocked(NDKEvent).mock.results[0].value as FakeEvent;
    expect(ev.tags).toContainEqual(['k', '1']);
  });

  it('stringifies non-kind-1 event kinds', async () => {
    await publishDeletion(makeNdk(), 'xyz789', 30023);
    const ev = vi.mocked(NDKEvent).mock.results[0].value as FakeEvent;
    expect(ev.tags).toContainEqual(['k', '30023']);
  });

  it('calls sign before publish', async () => {
    const order: string[] = [];
    signMock.mockImplementation(() => { order.push('sign'); return Promise.resolve(); });
    publishMock.mockImplementation(() => { order.push('publish'); return Promise.resolve(); });
    await publishDeletion(makeNdk(), 'abc123', 1);
    expect(order).toEqual(['sign', 'publish']);
  });
});
