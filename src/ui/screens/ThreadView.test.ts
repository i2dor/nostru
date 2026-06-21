import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/ndk', () => ({ useNDK: vi.fn(() => ({ ndk: null })) }));
vi.mock('../../core/events/publish', () => ({ publishNote: vi.fn() }));
vi.mock('../../core/events/nip10', () => ({
  buildReplyTags: vi.fn(() => []),
  parseNIP10: vi.fn(() => ({ root: null, reply: null, mentions: [] })),
}));
vi.mock('../components/NoteCard', () => ({ NoteCard: vi.fn(() => null) }));
vi.mock('../feed/hooks', () => ({ useFeed: vi.fn(() => ({ events: [], eose: false })) }));

describe('ThreadView module API', () => {
  it('exports ThreadView as a function', async () => {
    const { ThreadView } = await import('./ThreadView');
    expect(typeof ThreadView).toBe('function');
  });
});
