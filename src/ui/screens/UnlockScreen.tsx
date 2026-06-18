import { useState } from 'react';
import { IconLock } from '@tabler/icons-react';
import { useAccount, useNpub } from '../context/AccountContext';
import { truncateNpub } from '../../core/keys';

export function UnlockScreen() {
  const { unlock } = useAccount();
  const npub = useNpub();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleUnlock() {
    if (!password) return;
    setError('');
    setBusy(true);
    try {
      await unlock(password);
    } catch {
      setError('Wrong password');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <IconLock size={32} className="text-zinc-400" />
          </div>
          <h2 className="text-base font-medium">Nostru is locked</h2>
          {npub && (
            <p className="font-mono text-xs text-zinc-400">{truncateNpub(npub)}</p>
          )}
        </div>
        <div className="space-y-2">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="Password"
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleUnlock}
            disabled={busy || !password}
            className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Unlocking...' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}
