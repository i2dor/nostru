import { useEffect, useState, useCallback } from 'react';
import { IconPlus, IconTrash, IconRefresh, IconSun, IconMoon, IconX, IconEyeOff, IconShieldOff, IconShieldCheck } from '@tabler/icons-react';
import { useNDK } from '../../core/ndk';
import { DEFAULT_RELAYS } from '../../core/ndk/config';
import { getSavedRelays, saveRelays, type RelayConfig } from '../../core/store/relays';
import { setTheme, applyTheme, type Theme } from '../../core/store/theme';
import { useBlocks, useMutes, useProfile } from '../feed/hooks';
import { removeBlock } from '../../core/store/blocks';
import { removeMute, getMutes } from '../../core/store/mutes';
import { publishMuteList, publishRelayList } from '../../core/events/lists';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { getNewTabOverride, setNewTabOverride } from '../../core/store/settings';

interface RelayStatus {
  url: string;
  connected: boolean;
  connecting: boolean;
  authenticated: boolean;
}

// NDKRelayStatus: 0=CONNECTING 1=CONNECTED 2=DISCONNECTED 3=RECONNECTING
// 4=FLAPPING 5=DISCONNECTING 6=AUTH_REQUESTED 7=AUTHENTICATING 8=AUTHENTICATED
export function relayStatusFlags(status: number): { connected: boolean; connecting: boolean; authenticated: boolean } {
  return {
    connected:     status === 1 || status === 8,
    connecting:    status === 0 || status === 3 || status === 4 || status === 6 || status === 7,
    authenticated: status === 8,
  };
}

function normalizeUrl(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url.endsWith('/') ? url : `${url}/`;
  }
}

function StatusDot({ connected, connecting, authenticated }: { connected: boolean; connecting: boolean; authenticated: boolean }) {
  if (authenticated) return <IconShieldCheck size={12} className="text-green-500 shrink-0" />;
  if (connected) return <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />;
  if (connecting) return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />;
}

function UserListRow({ pubkey, actionLabel, actionIcon: ActionIcon, onAction }: {
  pubkey: string;
  actionLabel: string;
  actionIcon: React.ElementType;
  onAction: () => void;
}) {
  const profile = useProfile(pubkey);
  const npub = encodePubkey(pubkey);
  const display = profile?.displayName ?? profile?.name ?? truncateNpub(npub);
  return (
    <li className="flex items-center gap-2 py-1.5">
      {profile?.image
        ? <img src={profile.image} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        : <span className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
      }
      <span className="flex-1 text-sm truncate">{display}</span>
      <button
        onClick={onAction}
        title={actionLabel}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500 transition-colors shrink-0"
      >
        <ActionIcon size={13} />
        {actionLabel}
      </button>
    </li>
  );
}

function RwToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`Toggle ${label}`}
      className={`text-xs font-mono w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0 ${
        active
          ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
          : 'text-zinc-300 dark:text-zinc-600'
      }`}
    >
      {label}
    </button>
  );
}

export function SettingsScreen({ onOpenWallet, onOpenPermissions, narrow, wideLayout, onWideLayoutChange }: {
  onOpenWallet: () => void;
  onOpenPermissions: () => void;
  narrow: boolean;
  wideLayout: boolean;
  onWideLayoutChange: (v: boolean) => Promise<void>;
}) {
  const { ndk } = useNDK();
  const [relays, setRelays] = useState<RelayConfig[]>([]);
  const [relayStatuses, setRelayStatuses] = useState<Map<string, RelayStatus>>(new Map());
  const [newRelay, setNewRelay] = useState('');
  const [addError, setAddError] = useState('');
  const [theme, setThemeState] = useState<Theme>(
    () => document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
  const [newTabOverrideState, setNewTabOverrideState] = useState(false);
  const blocks = useBlocks();
  const mutes = useMutes();
  const blockedPubkeys = Array.from(blocks);
  const mutedPubkeys = Array.from(mutes);

  useEffect(() => {
    getSavedRelays().then(setRelays);
    getNewTabOverride().then(setNewTabOverrideState);
  }, []);

  useEffect(() => {
    if (!ndk) return;
    const poll = () => {
      const map = new Map<string, RelayStatus>();
      for (const { url } of relays) {
        const withSlash = normalizeUrl(url);
        const withoutSlash = withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
        const relay = ndk.pool.relays.get(withSlash) ?? ndk.pool.relays.get(withoutSlash) ?? ndk.pool.relays.get(url);
        const status = relay?.status ?? -1;
        map.set(url, { url, ...relayStatusFlags(status) });
      }
      setRelayStatuses(map);
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [ndk, relays]);

  const handleAdd = useCallback(async () => {
    const trimmed = newRelay.trim();
    if (!trimmed) return;
    setAddError('');
    try {
      new URL(trimmed);
    } catch {
      setAddError('Invalid URL');
      return;
    }
    if (!trimmed.startsWith('wss://') && !trimmed.startsWith('ws://')) {
      setAddError('Must start with wss:// or ws://');
      return;
    }
    if (relays.some(r => r.url === trimmed)) {
      setAddError('Already in list');
      return;
    }
    const updated = [...relays, { url: trimmed, read: true, write: true }];
    setRelays(updated);
    setNewRelay('');
    await saveRelays(updated);
    if (ndk) {
      ndk.addExplicitRelay(trimmed, undefined, true);
      publishRelayList(ndk, updated).catch(() => {});
    }
  }, [newRelay, relays, ndk]);

  const handleRemove = useCallback(async (url: string) => {
    const updated = relays.filter(r => r.url !== url);
    setRelays(updated);
    await saveRelays(updated);
    if (ndk) {
      ndk.pool.removeRelay(normalizeUrl(url));
      publishRelayList(ndk, updated).catch(() => {});
    }
  }, [relays, ndk]);

  const handleToggleRead = useCallback(async (url: string) => {
    const updated = relays.map(r => r.url === url ? { ...r, read: !r.read } : r);
    setRelays(updated);
    await saveRelays(updated);
    if (ndk) publishRelayList(ndk, updated).catch(() => {});
  }, [relays, ndk]);

  const handleToggleWrite = useCallback(async (url: string) => {
    const updated = relays.map(r => r.url === url ? { ...r, write: !r.write } : r);
    setRelays(updated);
    await saveRelays(updated);
    if (ndk) publishRelayList(ndk, updated).catch(() => {});
  }, [relays, ndk]);

  const handleReset = useCallback(async () => {
    const defaults = DEFAULT_RELAYS.map(url => ({ url, read: true, write: true }));
    if (ndk) {
      ndk.pool.relays.forEach((_, url) => ndk.pool.removeRelay(url));
      for (const { url } of defaults) ndk.addExplicitRelay(url, undefined, true);
      publishRelayList(ndk, defaults).catch(() => {});
    }
    setRelays(defaults);
    await saveRelays(defaults);
  }, [ndk]);

  const handleThemeToggle = useCallback(async () => {
    const next: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    setThemeState(next);
    applyTheme(next);
    await setTheme(next);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleAdd();
  }, [handleAdd]);

  const handleUnblock = useCallback(async (pubkey: string) => {
    await removeBlock(pubkey);
  }, []);

  const handleUnmute = useCallback(async (pubkey: string) => {
    await removeMute(pubkey);
    if (ndk) {
      const remaining = await getMutes();
      publishMuteList(ndk, remaining).catch(() => {});
    }
  }, [ndk]);

  const handleNewTabOverrideChange = useCallback(async (v: boolean) => {
    setNewTabOverrideState(v);
    await setNewTabOverride(v);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <section className="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Appearance</h2>
        <button
          onClick={handleThemeToggle}
          className="flex items-center justify-between w-full py-2"
        >
          <span className="text-sm">Theme</span>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            {theme === 'dark' ? <IconMoon size={14} /> : <IconSun size={14} />}
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>
        {!narrow && (
          <button
            onClick={() => void onWideLayoutChange(!wideLayout)}
            className="flex items-center justify-between w-full py-2"
          >
            <span className="text-sm">Wide layout (new tab)</span>
            <span className={`w-8 h-4 rounded-full transition-colors relative ${wideLayout ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${wideLayout ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </span>
          </button>
        )}
        <button
          onClick={() => void handleNewTabOverrideChange(!newTabOverrideState)}
          className="flex items-center justify-between w-full py-2"
        >
          <span className="text-sm">Override new tab page</span>
          <span className={`w-8 h-4 rounded-full transition-colors relative ${newTabOverrideState ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${newTabOverrideState ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </span>
        </button>
      </section>

      <section className="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Relays</h2>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <IconRefresh size={12} /> Reset
          </button>
        </div>

        <ul className="space-y-1 mb-3">
          {relays.map(({ url, read, write }) => {
            const entry = relayStatuses.get(url);
            return (
              <li key={url} className="flex items-center gap-1.5 py-1">
                <StatusDot
                  connected={entry?.connected ?? false}
                  connecting={entry?.connecting ?? false}
                  authenticated={entry?.authenticated ?? false}
                />
                <span className="flex-1 text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">{url}</span>
                <RwToggle active={read} label="R" onClick={() => void handleToggleRead(url)} />
                <RwToggle active={write} label="W" onClick={() => void handleToggleWrite(url)} />
                <button
                  onClick={() => void handleRemove(url)}
                  className="text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors shrink-0"
                  aria-label="Remove relay"
                >
                  <IconTrash size={13} />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <input
            value={newRelay}
            onChange={e => { setNewRelay(e.target.value); setAddError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="wss://relay.example.com"
            className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={() => void handleAdd()}
            className="px-2 py-1.5 rounded bg-accent text-white text-xs flex items-center gap-1 hover:bg-accent/90 transition-colors"
          >
            <IconPlus size={13} /> Add
          </button>
        </div>
        {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
      </section>

      <section className="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">More</h2>
        <button
          onClick={onOpenWallet}
          className="w-full text-left py-2 text-sm hover:text-accent transition-colors"
        >
          Wallet
        </button>
        <button
          onClick={onOpenPermissions}
          className="w-full text-left py-2 text-sm hover:text-accent transition-colors"
        >
          Connected sites
        </button>
        <a
          href="https://nostru.net"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full py-2 text-sm hover:text-accent transition-colors"
        >
          <span>Get your name@nostru.net</span>
          <span className="text-xs text-zinc-400">nostru.net</span>
        </a>
      </section>

      {blockedPubkeys.length > 0 && (
        <section className="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Blocked users ({blockedPubkeys.length})
          </h2>
          <ul className="space-y-0.5">
            {blockedPubkeys.map(pk => (
              <UserListRow
                key={pk}
                pubkey={pk}
                actionLabel="Unblock"
                actionIcon={IconShieldOff}
                onAction={() => void handleUnblock(pk)}
              />
            ))}
          </ul>
        </section>
      )}

      {mutedPubkeys.length > 0 && (
        <section className="px-4 py-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Muted users ({mutedPubkeys.length})
          </h2>
          <ul className="space-y-0.5">
            {mutedPubkeys.map(pk => (
              <UserListRow
                key={pk}
                pubkey={pk}
                actionLabel="Unmute"
                actionIcon={IconEyeOff}
                onAction={() => void handleUnmute(pk)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
