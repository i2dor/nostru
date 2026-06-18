import {
  IconLayoutGrid,
  IconBell,
  IconMail,
  IconSearch,
  IconLock,
  IconChevronDown,
  IconUserCircle,
  IconArrowLeft,
} from '@tabler/icons-react';
import { useState } from 'react';
import { AccountProvider, useAccount, useNpub, usePrivkey } from './context/AccountContext';
import { NDKProvider } from '../core/ndk';
import { NavProvider, useNav } from './context/NavContext';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { UnlockScreen } from './screens/UnlockScreen';
import { ThreadView } from './screens/ThreadView';
import { ProfileView } from './screens/ProfileView';
import { FeedView } from './feed/FeedView';
import { truncateNpub, encodePubkey } from '../core/keys';

function AccountSwitcher() {
  const { session, switchAccount, lock } = useAccount();
  const [open, setOpen] = useState(false);
  const npub = useNpub();

  if (session.status !== 'unlocked') return null;

  return (
    <div className="relative">
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
            <button
              key={account.pubkey}
              onClick={() => { switchAccount(account.pubkey); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                account.pubkey === session.account.pubkey ? 'text-accent font-medium' : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {truncateNpub(encodePubkey(account.pubkey))}
            </button>
          ))}
          <div className="border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-1">
            <button
              onClick={() => { lock(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
            >
              <IconLock size={12} /> Lock
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
];

function PlaceholderTab({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <p className="text-zinc-500 text-sm">{label}</p>
      <p className="text-zinc-400 text-xs">{note}</p>
    </div>
  );
}

function MainContent({ narrow, pubkey }: { narrow: boolean; pubkey: string }) {
  const { current, pop, canPop } = useNav();
  const [activeTab, setActiveTab] = useState(0);

  const headerLeft = canPop ? (
    <button
      onClick={pop}
      className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
    >
      <IconArrowLeft size={16} />
      <span>Back</span>
    </button>
  ) : (
    <span className="text-accent font-medium text-sm">Nostru</span>
  );

  return (
    <div className={`flex flex-col h-full ${narrow ? 'w-full' : 'max-w-xl mx-auto w-full'}`}>
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        {headerLeft}
        <AccountSwitcher />
      </header>

      {current.view === 'thread' ? (
        <ThreadView event={current.event} />
      ) : current.view === 'profile' ? (
        <ProfileView pubkey={current.pubkey} />
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
            {activeTab === 1 && <PlaceholderTab label="Notifications" note="Coming in M8" />}
            {activeTab === 2 && <PlaceholderTab label="Messages" note="Coming in M7" />}
            {activeTab === 3 && <PlaceholderTab label="Search" note="Coming in M8" />}
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
      <Router narrow={narrow} />
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
  return (
    <AccountProvider>
      <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <NDKBridge narrow={narrow} />
      </div>
    </AccountProvider>
  );
}
