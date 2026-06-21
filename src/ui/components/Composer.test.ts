import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/ndk', () => ({ useNDK: vi.fn(() => ({ ndk: null })) }));
vi.mock('../../core/events/publish', () => ({ publishNote: vi.fn() }));
vi.mock('../../core/store/draft', () => ({
  getDraft: vi.fn(async () => ''),
  saveDraft: vi.fn(async () => {}),
  clearDraft: vi.fn(async () => {}),
}));

describe('Composer module API', () => {
  it('exports Composer as a function', async () => {
    const { Composer } = await import('./Composer');
    expect(typeof Composer).toBe('function');
  });
});
