// Shell is the root layout component; behaviour is covered by context + screen unit tests.
// This file verifies the export exists so renames surface immediately.

import { describe, it, expect, vi } from 'vitest';

vi.mock('./context/AccountContext', () => ({
  AccountProvider: vi.fn(({ children }) => children),
  useAccount: vi.fn(() => ({ session: { status: 'loading' }, lock: vi.fn() })),
  useNpub: vi.fn(() => null),
  usePrivkey: vi.fn(() => null),
}));
vi.mock('../core/ndk', () => ({
  NDKProvider: vi.fn(({ children }) => children),
  useNDK: vi.fn(() => ({ ndk: null })),
}));
vi.mock('./context/NavContext', () => ({
  NavProvider: vi.fn(({ children }) => children),
  useNav: vi.fn(() => ({ current: { view: 'feed' }, pop: vi.fn(), canPop: false })),
}));
vi.mock('./context/WalletContext', () => ({
  WalletProvider: vi.fn(({ children }) => children),
  useWallet: vi.fn(() => ({ isConnected: false })),
}));
vi.mock('./screens/OnboardingScreen', () => ({ OnboardingScreen: vi.fn(() => null) }));
vi.mock('./screens/UnlockScreen', () => ({ UnlockScreen: vi.fn(() => null) }));
vi.mock('./screens/ThreadView', () => ({ ThreadView: vi.fn(() => null) }));
vi.mock('./screens/ProfileView', () => ({ ProfileView: vi.fn(() => null), FollowListView: vi.fn(() => null) }));
vi.mock('./screens/PermissionsScreen', () => ({ PermissionsScreen: vi.fn(() => null) }));
vi.mock('./screens/WalletScreen', () => ({ WalletScreen: vi.fn(() => null) }));
vi.mock('./screens/MessagesScreen', () => ({ MessagesScreen: vi.fn(() => null) }));
vi.mock('./screens/ConversationView', () => ({ ConversationView: vi.fn(() => null) }));
vi.mock('./screens/NotificationsScreen', () => ({ NotificationsScreen: vi.fn(() => null) }));
vi.mock('./screens/SearchScreen', () => ({ SearchScreen: vi.fn(() => null), buildFilter: vi.fn() }));
vi.mock('./screens/BookmarksScreen', () => ({ BookmarksScreen: vi.fn(() => null) }));
vi.mock('./screens/SettingsScreen', () => ({ SettingsScreen: vi.fn(() => null) }));
vi.mock('./screens/HelpScreen', () => ({ HelpScreen: vi.fn(() => null) }));
vi.mock('./screens/EventRefView', () => ({ EventRefView: vi.fn(() => null) }));
vi.mock('./feed/FeedView', () => ({ FeedView: vi.fn(() => null) }));
vi.mock('../core/keys', () => ({ truncateNpub: vi.fn(s => s), encodePubkey: vi.fn(s => s) }));
vi.mock('../core/store/theme', () => ({ getTheme: vi.fn(), applyTheme: vi.fn() }));
vi.mock('../core/store/settings', () => ({ getWideLayout: vi.fn(), setWideLayout: vi.fn() }));

describe('Shell module API', () => {
  it('exports Shell as a function', async () => {
    const { Shell } = await import('./Shell');
    expect(typeof Shell).toBe('function');
  });
});
