import { describe, it, expect, vi } from 'vitest';
import { fetchNip352Address, publishNip352Address } from './nip352';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEvent(sp1: string | null, createdAt: number, d = 'mainnet') {
  const tags: string[][] = [['d', d]];
  if (sp1 !== null) tags.push(['sp', sp1]);
  return { tags, created_at: createdAt };
}

type FakeNdk = { fetchEvents: ReturnType<typeof vi.fn> };

function makeNdk(events: ReturnType<typeof makeEvent>[]): FakeNdk {
  return { fetchEvents: vi.fn().mockResolvedValue(new Set(events)) };
}

const PUBKEY = 'a'.repeat(64);
const SP1 = 'sp1qqtest';

// ── NDKEvent mock (used by publishNip352Address) ──────────────────────────────

vi.mock('@nostr-dev-kit/ndk', async () => {
  const actual = await vi.importActual<typeof import('@nostr-dev-kit/ndk')>('@nostr-dev-kit/ndk');
  return {
    ...actual,
    NDKEvent: vi.fn().mockImplementation((_ndk: unknown, init: { kind: number; content: string; tags: string[][] }) => ({
      kind: init.kind,
      content: init.content,
      tags: init.tags,
      sign: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

// ── publishNip352Address ──────────────────────────────────────────────────────

describe('publishNip352Address', () => {
  it('signs and publishes a kind:30352 event with correct tags', async () => {
    const mockEvent = { sign: vi.fn().mockResolvedValue(undefined), publish: vi.fn().mockResolvedValue(undefined), tags: [] as string[][] };
    const { NDKEvent } = await import('@nostr-dev-kit/ndk');
    vi.mocked(NDKEvent).mockImplementationOnce((_ndk, init) => {
      mockEvent.tags = (init as { tags: string[][] }).tags;
      return mockEvent as never;
    });
    await publishNip352Address({} as never, 'sp1qqtest');
    expect(mockEvent.sign).toHaveBeenCalled();
    expect(mockEvent.publish).toHaveBeenCalled();
    expect(mockEvent.tags).toContainEqual(['d', 'mainnet']);
    expect(mockEvent.tags).toContainEqual(['sp', 'sp1qqtest']);
  });

  it('uses the provided network in the d tag', async () => {
    const mockEvent = { sign: vi.fn().mockResolvedValue(undefined), publish: vi.fn().mockResolvedValue(undefined), tags: [] as string[][] };
    const { NDKEvent } = await import('@nostr-dev-kit/ndk');
    vi.mocked(NDKEvent).mockImplementationOnce((_ndk, init) => {
      mockEvent.tags = (init as { tags: string[][] }).tags;
      return mockEvent as never;
    });
    await publishNip352Address({} as never, 'sp1qqsignet', 'signet');
    expect(mockEvent.tags).toContainEqual(['d', 'signet']);
    expect(mockEvent.tags).toContainEqual(['sp', 'sp1qqsignet']);
  });

  it('includes payment_pubkey tag when provided', async () => {
    const mockEvent = { sign: vi.fn().mockResolvedValue(undefined), publish: vi.fn().mockResolvedValue(undefined), tags: [] as string[][] };
    const { NDKEvent } = await import('@nostr-dev-kit/ndk');
    vi.mocked(NDKEvent).mockImplementationOnce((_ndk, init) => {
      mockEvent.tags = (init as { tags: string[][] }).tags;
      return mockEvent as never;
    });
    await publishNip352Address({} as never, 'sp1qqtest', 'mainnet', 'abcd1234');
    expect(mockEvent.tags).toContainEqual(['payment_pubkey', 'abcd1234']);
  });
});

// ── fetchNip352Address ────────────────────────────────────────────────────────

describe('fetchNip352Address', () => {
  it('returns null when no events found', async () => {
    const ndk = makeNdk([]);
    expect(await fetchNip352Address(ndk as never, PUBKEY)).toBeNull();
  });

  it('returns the sp tag value from a valid event', async () => {
    const ndk = makeNdk([makeEvent(SP1, 1000)]);
    expect(await fetchNip352Address(ndk as never, PUBKEY)).toBe(SP1);
  });

  it('picks the most recent event when multiple exist', async () => {
    const ndk = makeNdk([
      makeEvent('sp1qqold', 900),
      makeEvent('sp1qqnew', 1100),
      makeEvent('sp1qqmid', 1000),
    ]);
    expect(await fetchNip352Address(ndk as never, PUBKEY)).toBe('sp1qqnew');
  });

  it('returns null when the event has no sp tag', async () => {
    const ndk = makeNdk([makeEvent(null, 1000)]);
    expect(await fetchNip352Address(ndk as never, PUBKEY)).toBeNull();
  });

  it('queries with correct filter', async () => {
    const ndk = makeNdk([]);
    await fetchNip352Address(ndk as never, PUBKEY, 'signet');
    expect(ndk.fetchEvents).toHaveBeenCalledWith({
      kinds: [30352],
      authors: [PUBKEY],
      '#d': ['signet'],
      limit: 5,
    });
  });
});
