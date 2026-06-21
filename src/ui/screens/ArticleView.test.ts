import { describe, it, expect, vi } from 'vitest';

vi.mock('marked', () => ({ marked: { parse: vi.fn(() => '<p>content</p>'), setOptions: vi.fn() } }));
vi.mock('../feed/hooks', () => ({ useProfile: vi.fn(() => null) }));
vi.mock('../../core/keys', () => ({ encodePubkey: vi.fn(s => s), truncateNpub: vi.fn(s => s) }));
vi.mock('../components/NoteCard', () => ({ relativeTime: vi.fn(() => '1h') }));

describe('ArticleView module API', () => {
  it('exports ArticleView as a function', async () => {
    const { ArticleView } = await import('./ArticleView');
    expect(typeof ArticleView).toBe('function');
  });
});
