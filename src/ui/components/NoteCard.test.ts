// NoteCard is a React view; its reaction logic is covered by reactions tests.
// This file verifies the export exists so renames/removals surface immediately.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/keys', () => ({ encodePubkey: vi.fn(() => 'aa'), truncateNpub: vi.fn(s => s) }));
vi.mock('../feed/hooks', () => ({ useProfile: vi.fn(() => null) }));
vi.mock('../../core/ndk', () => ({ useNDK: vi.fn(() => ({ ndk: null })) }));
vi.mock('../../core/events/reactions', () => ({ publishLike: vi.fn(), publishRepost: vi.fn() }));
vi.mock('../context/NavContext', () => ({ useNav: vi.fn(() => ({ push: vi.fn() })) }));
vi.mock('./ZapModal', () => ({ ZapModal: vi.fn(() => null) }));

describe('NoteCard module API', () => {
  it('exports NoteCard as a function', async () => {
    const { NoteCard } = await import('./NoteCard');
    expect(typeof NoteCard).toBe('function');
  });
});
