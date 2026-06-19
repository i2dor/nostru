import {
  IconLayoutGrid,
  IconBell,
  IconMail,
  IconSearch,
  IconBookmark,
  IconWallet,
  IconLogout,
  IconTrash,
  IconChevronDown,
  IconUserCircle,
  IconArrowLeft,
  IconShield,
  IconSettings,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { AccountProvider, useAccount, useNpub, usePrivkey } from './context/AccountContext';
import { NDKProvider } from '../core/ndk';
import { NavProvider, useNav } from './context/NavContext';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { UnlockScreen } from './screens/UnlockScreen';
import { ThreadView } from './screens/ThreadView';
import { ProfileView } from './screens/ProfileView';
import { PermissionsScreen } from './screens/PermissionsScreen';
import { WalletScreen } from './screens/WalletScreen';
import { MessagesScreen } from './screens/MessagesScreen';
import { ConversationView } from './screens/ConversationView';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { BookmarksScreen } from './screens/BookmarksScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { EventRefView } from './screens/EventRefView';
import { WalletProvider } from './context/WalletContext';
import { FeedView } from './feed/FeedView';
import { truncateNpub, encodePubkey } from '../core/keys';
import { getTheme, applyTheme } from '../core/store/theme';
import { getWideLayout, setWideLayout } from '../core/store/settings';

type MainView = 'app' | 'permissions' | 'settings' | 'wallet';

function AccountSwitcher({ onNavigate }: { onNavigate: (view: MainView) => void }) {
  const { session, switchAccount, lock, deleteAccount } = useAccount();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const npub = useNpub();

  if (session.status !== 'unlocked') return null;

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={() => { onNavigate('settings'); }}
        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        aria-label="Settings"
      >
        <IconSettings size={16} />
      </button>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
      >
        <IconUserCircle size={16} />
        <span className="font-mono">{npub ? truncateNpub(npub, 6) : ''}</span>
        <IconChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 z-50">
          {session.allAccounts.map(account => (
            <div key={account.pubkey} className="flex items-center group">
              <button
                onClick={() => { switchAccount(account.pubkey); setOpen(false); setConfirmDelete(null); }}
                className={`flex-1 text-left px-3 py-2 text-xs font-mono hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                  account.pubkey === session.account.pubkey ? 'text-accent font-medium' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {truncateNpub(encodePubkey(account.pubkey))}
              </button>
              {confirmDelete === account.pubkey
                ? (
                  <button
                    onClick={() => { void deleteAccount(account.pubkey); setConfirmDelete(null); setOpen(false); }}
                    className="pr-3 text-xs text-red-500 font-medium hover:text-red-600 whitespace-nowrap"
                  >
                    Remove?
                  </button>
                )
                : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(account.pubkey); }}
                    className="pr-3 text-zinc-300 dark:text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove account"
                  >
                    <IconTrash size={12} />
                  </button>
                )
              }
            </div>
          ))}
          <div className="border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-1">
            <button
              onClick={() => { onNavigate('permissions'); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
            >
              <IconShield size={12} /> Connected sites
            </button>
            <button
              onClick={() => { lock(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
            >
              <IconLogout size={12} /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { icon: IconLayoutGrid, label: 'Feed' },
  { icon: IconBell, label: 'Notifications' },
  { icon: IconMail, label: 'Messages' },
  { icon: IconSearch, label: 'Search' },
  { icon: IconBookmark, label: 'Saved' },
  { icon: IconWallet, label: 'Wallet' },
];

function MainContent({ narrow, pubkey }: { narrow: boolean; pubkey: string }) {
  const { current, pop, canPop } = useNav();
  const [activeTab, setActiveTab] = useState(0);
  const [mainView, setMainView] = useState<MainView>('app');
  const [wideLayout, setWideLayoutState] = useState(false);

  useEffect(() => {
    getWideLayout().then(setWideLayoutState);
  }, []);

  const handleWideLayoutChange = useCallback(async (value: boolean) => {
    setWideLayoutState(value);
    await setWideLayout(value);
  }, []);

  const isOverlay = mainView !== 'app';
  const showBack = canPop || isOverlay;

  const headerTitles: Partial<Record<MainView, string>> = {
    permissions: 'Connected sites',
    settings: 'Settings',
    wallet: 'Wallet',
  };

  const headerLeft = showBack ? (
    <button
      onClick={() => { if (isOverlay) setMainView('app'); else pop(); }}
      className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
    >
      <IconArrowLeft size={16} />
      <span>Back</span>
    </button>
  ) : (
    <span className="text-accent font-medium text-sm">Nostru</span>
  );

  const handleNavigate = (view: MainView) => setMainView(view);

  const widthCls = narrow || wideLayout ? 'w-full' : 'w-full max-w-2xl mx-auto';

  return (
    <div className={`flex flex-col h-full ${widthCls}`}>
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        {headerLeft}
        {isOverlay
          ? <span className="text-sm font-medium">{headerTitles[mainView] ?? ''}</span>
          : <AccountSwitcher onNavigate={handleNavigate} />
        }
      </header>

      {mainView === 'permissions' ? (
        <PermissionsScreen />
      ) : mainView === 'settings' ? (
        <SettingsScreen
          onOpenWallet={() => setMainView('wallet')}
          onOpenPermissions={() => setMainView('permissions')}
          narrow={narrow}
          wideLayout={wideLayout}
          onWideLayoutChange={handleWideLayoutChange}
        />
      ) : mainView === 'wallet' ? (
        <WalletScreen />
      ) : current.view === 'thread' ? (
        <ThreadView event={current.event} />
      ) : current.view === 'profile' ? (
        <ProfileView pubkey={current.pubkey} />
      ) : current.view === 'conversation' ? (
        <ConversationView peerPubkey={current.peerPubkey} />
      ) : current.view === 'search' ? (
        <SearchScreen initialQuery={current.query} />
      ) : current.view === 'event-ref' ? (
        <EventRefView eventId={current.eventId} />
      ) : current.view === 'bookmarks' ? (
        <BookmarksScreen />
      ) : (
        <>
          <nav className={`flex border-b border-zinc-100 dark:border-zinc-800 shrink-0 ${narrow ? 'justify-around' : 'gap-1 px-2'}`}>
            {NAV_ITEMS.map(({ icon: Icon, label }, i) => (
              <button
                key={label}
                onClick={() => setActiveTab(i)}
                title={label}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs transition-colors border-b-2 ${
                  activeTab === i
                    ? 'border-accent text-accent'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                } ${narrow ? 'flex-col text-[10px]' : ''}`}
              >
                <Icon size={18} />
                {!narrow && <span>{label}</span>}
              </button>
            ))}
          </nav>
          <main className="flex-1 overflow-hidden">
            {activeTab === 0 && <FeedView pubkey={pubkey} />}
            {activeTab === 1 && <NotificationsScreen />}
            {activeTab === 2 && <MessagesScreen />}
            {activeTab === 3 && <SearchScreen />}
            {activeTab === 4 && <BookmarksScreen />}
            {activeTab === 5 && <WalletScreen />}
          </main>
        </>
      )}
    </div>
  );
}

function MainView({ narrow }: { narrow: boolean }) {
  const { session } = useAccount();
  if (session.status !== 'unlocked') return null;

  return (
    <NavProvider>
      <MainContent narrow={narrow} pubkey={session.account.pubkey} />
    </NavProvider>
  );
}

function NDKBridge({ children, narrow }: { children?: never; narrow: boolean }) {
  const privkey = usePrivkey();
  return (
    <NDKProvider privkey={privkey}>
      <WalletProvider>
        <Router narrow={narrow} />
      </WalletProvider>
    </NDKProvider>
  );
}

function Router({ narrow }: { narrow: boolean }) {
  const { session } = useAccount();

  if (session.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }
  if (session.status === 'onboarding') return <OnboardingScreen />;
  if (session.status === 'locked') return <UnlockScreen />;
  return <MainView narrow={narrow} />;
}

export function Shell({ narrow = false }: { narrow?: boolean }) {
  useEffect(() => {
    getTheme().then(applyTheme);
  }, []);

  return (
    <AccountProvider>
      <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <NDKBridge narrow={narrow} />
      </div>
    </AccountProvider>
  );
}
