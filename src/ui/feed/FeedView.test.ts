import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/ndk', () => ({ useNDK: vi.fn(() => ({ ndk: null })) }));
vi.mock('./hooks', () => ({
  useFeed: vi.fn(() => ({ events: [], eose: false })),
  useFollows: vi.fn(() => []),
  useGlobalFeed: vi.fn(() => ({ events: [], eose: false })),
  useBlocks: vi.fn(() => new Set()),
  useMutes: vi.fn(() => new Set()),
  useProfile: vi.fn(() => null),
}));
vi.mock('../components/NoteCard', () => ({ NoteCard: vi.fn(() => null) }));
vi.mock('../components/Composer', () => ({ Composer: vi.fn(() => null) }));
vi.mock('../../core/keys', () => ({ encodePubkey: vi.fn(s => s), truncateNpub: vi.fn(s => s) }));
vi.mock('../../core/feed/spamFilter', () => ({ isSpam: vi.fn(() => false) }));
vi.mock('../../core/store/spamFilter', () => ({ getSpamFilterEnabled: vi.fn(async () => true) }));

describe('FeedView module API', () => {
  it('exports FeedView as a function', async () => {
    const { FeedView } = await import('./FeedView');
    expect(typeof FeedView).toBe('function');
  });
});
