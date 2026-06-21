import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

type ThreadNav = { view: 'thread'; event: NDKEvent };
type ProfileNav = { view: 'profile'; pubkey: string };
type ConversationNav = { view: 'conversation'; peerPubkey: string };
type SearchNav = { view: 'search'; query: string };
type EventRefNav = { view: 'event-ref'; eventId: string };
type BookmarksNav = { view: 'bookmarks' };
type FollowListNav = { view: 'follow-list'; pubkeys: string[]; title: string };
type ArticleNav = { view: 'article'; event: NDKEvent };
type NavState = { view: 'feed' } | ThreadNav | ProfileNav | ConversationNav | SearchNav | EventRefNav | BookmarksNav | FollowListNav | ArticleNav;

interface NavContextValue {
  current: NavState;
  push: (state: ThreadNav | ProfileNav | ConversationNav | SearchNav | EventRefNav | BookmarksNav | FollowListNav | ArticleNav) => void;
  pop: () => void;
  canPop: boolean;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<NavState[]>([{ view: 'feed' }]);

  const push = useCallback((state: ThreadNav | ProfileNav | ConversationNav | SearchNav | EventRefNav | BookmarksNav | FollowListNav | ArticleNav) => {
    setStack(prev => [...prev, state]);
  }, []);

  const pop = useCallback(() => {
    setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  }, []);

  const current = stack[stack.length - 1];
  const canPop = stack.length > 1;

  return (
    <NavContext.Provider value={{ current, push, pop, canPop }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
