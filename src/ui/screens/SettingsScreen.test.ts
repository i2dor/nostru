import { describe, it, expect, vi } from 'vitest';

vi.mock('../feed/hooks', () => ({ useBlocks: vi.fn(() => []), useMutes: vi.fn(() => []), useProfile: vi.fn(() => ({})) }));
vi.mock('../../core/ndk', () => ({ useNDK: vi.fn(() => ({ ndk: null, connected: false })) }));
vi.mock('../../core/store/relays', () => ({ getSavedRelays: vi.fn(() => Promise.resolve([])), saveRelays: vi.fn(), type: {} }));
vi.mock('../../core/store/settings', () => ({ getNewTabOverride: vi.fn(() => Promise.resolve(false)), setNewTabOverride: vi.fn() }));
vi.mock('../../core/store/theme', () => ({ setTheme: vi.fn(), applyTheme: vi.fn() }));
vi.mock('../../core/store/spamFilter', () => ({ getSpamFilterEnabled: vi.fn(async () => true), setSpamFilterEnabled: vi.fn() }));

import { relayStatusFlags } from './SettingsScreen';

// NDKRelayStatus numeric values (from @nostr-dev-kit/ndk)
// NDKRelayStatus: 0=CONNECTING 1=CONNECTED 2=DISCONNECTED 3=RECONNECTING
// 4=FLAPPING 5=DISCONNECTING 6=AUTH_REQUESTED 7=AUTHENTICATING 8=AUTHENTICATED

describe('relayStatusFlags', () => {
  it('CONNECTED (1) -> connected, not connecting, not authenticated', () => {
    expect(relayStatusFlags(1)).toEqual({ connected: true, connecting: false, authenticated: false });
  });

  it('AUTHENTICATED (8) -> connected and authenticated', () => {
    expect(relayStatusFlags(8)).toEqual({ connected: true, connecting: false, authenticated: true });
  });

  it('CONNECTING (0) -> connecting', () => {
    expect(relayStatusFlags(0)).toEqual({ connected: false, connecting: true, authenticated: false });
  });

  it('RECONNECTING (3) -> connecting', () => {
    expect(relayStatusFlags(3)).toEqual({ connected: false, connecting: true, authenticated: false });
  });

  it('FLAPPING (4) -> connecting', () => {
    expect(relayStatusFlags(4)).toEqual({ connected: false, connecting: true, authenticated: false });
  });

  it('AUTH_REQUESTED (6) -> connecting (auth in progress)', () => {
    expect(relayStatusFlags(6)).toEqual({ connected: false, connecting: true, authenticated: false });
  });

  it('AUTHENTICATING (7) -> connecting (auth in progress)', () => {
    expect(relayStatusFlags(7)).toEqual({ connected: false, connecting: true, authenticated: false });
  });

  it('DISCONNECTED (2) -> neither', () => {
    expect(relayStatusFlags(2)).toEqual({ connected: false, connecting: false, authenticated: false });
  });

  it('unknown (-1) -> neither', () => {
    expect(relayStatusFlags(-1)).toEqual({ connected: false, connecting: false, authenticated: false });
  });
});
