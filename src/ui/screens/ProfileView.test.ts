// ProfileView is a React view; NIP-352 discovery logic is unit-tested in
// src/core/events/nip352.test.ts. This file verifies the module export and
// mocks heavy dependencies so renames and import errors surface immediately.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/ndk', () => ({ useNDK: vi.fn(() => ({ ndk: null })) }));
vi.mock('../context/AccountContext', () => ({ useAccount: vi.fn(() => ({ session: { status: 'loading' } })) }));
vi.mock('../context/NavContext', () => ({ useNav: vi.fn(() => ({ push: vi.fn() })) }));
vi.mock('../context/WalletContext', () => ({ useWallet: vi.fn(() => ({ isConnected: false })) }));
vi.mock('../../core/events/nip352', () => ({ fetchNip352Address: vi.fn(() => Promise.resolve(null)) }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,')) } }));
vi.mock('../../core/nsp', () => ({ deriveNspAddress: vi.fn(() => null) }));
vi.mock('../../core/store/customSp', () => ({ getCustomSpAddress: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../feed/hooks', () => ({
  useProfile: vi.fn(() => null),
  useFollows: vi.fn(() => []),
  useFeed: vi.fn(() => ({ events: [], eose: false })),
  useNip05: vi.fn(() => null),
  useBlocks: vi.fn(() => new Set()),
  useMutes: vi.fn(() => new Set()),
}));
vi.mock('../../core/store/blocks', () => ({ addBlock: vi.fn(), removeBlock: vi.fn() }));
vi.mock('../../core/store/mutes', () => ({ addMute: vi.fn(), removeMute: vi.fn(), getMutes: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../core/events/lists', () => ({ publishMuteList: vi.fn(), fetchNip51List: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../core/events/follows', () => ({ follow: vi.fn(), unfollow: vi.fn() }));
vi.mock('../../core/events/publish', () => ({ publishProfile: vi.fn(), publishDeletion: vi.fn() }));
vi.mock('../components/NoteCard', () => ({ NoteCard: vi.fn(() => null) }));
vi.mock('../components/ZapModal', () => ({ ZapModal: vi.fn(() => null) }));
vi.mock('nostr-tools', () => ({ nip19: { npubEncode: vi.fn(s => s), noteEncode: vi.fn(s => s), decode: vi.fn() } }));
vi.mock('../../core/keys', () => ({ encodePubkey: vi.fn(s => s), truncateNpub: vi.fn(s => s) }));

describe('ProfileView module API', () => {
  it('exports ProfileView as a function', async () => {
    const { ProfileView } = await import('./ProfileView');
    expect(typeof ProfileView).toBe('function');
  });
});
