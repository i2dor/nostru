import { describe, it, expect, vi } from 'vitest';

vi.mock('../feed/hooks', () => ({ useProfile: vi.fn(() => null) }));
vi.mock('../../core/keys', () => ({ encodePubkey: vi.fn(s => s), truncateNpub: vi.fn(s => s) }));
vi.mock('../context/NavContext', () => ({ useNav: vi.fn(() => ({ push: vi.fn() })) }));
vi.mock('./NoteCard', () => ({ relativeTime: vi.fn(() => '1h') }));

describe('ArticleCard module API', () => {
  it('exports ArticleCard as a function', async () => {
    const { ArticleCard } = await import('./ArticleCard');
    expect(typeof ArticleCard).toBe('function');
  });
});
