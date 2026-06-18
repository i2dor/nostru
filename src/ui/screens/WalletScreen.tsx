import { useState } from 'react';
import { IconWallet, IconUnlink, IconBolt } from '@tabler/icons-react';
import { useWallet } from '../context/WalletContext';

export function WalletScreen() {
  const { nwcUri, balance, isConnected, connect, disconnect } = useWallet();
  const [input, setInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!input.trim()) return;
    setConnecting(true);
    setError('');
    try {
      await connect(input.trim());
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  if (isConnected) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-4 py-6 space-y-6">
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 text-center space-y-1">
            <IconBolt size={28} className="text-zap mx-auto" />
            <p className="text-3xl font-semibold tabular-nums">
              {balance === null ? '-' : balance.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400">sats</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Connected wallet</p>
            <p className="text-xs text-zinc-500 font-mono break-all">
              {nwcUri ? nwcUri.slice(0, 48) + '...' : ''}
            </p>
          </div>

          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <IconUnlink size={15} />
            Disconnect wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-6 space-y-5">
        <div className="flex items-center gap-2 text-zinc-500">
          <IconWallet size={20} />
          <span className="text-sm font-medium">Connect a wallet</span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Paste a NWC connection string to enable one-click zaps. Your wallet stays in control of funds - Nostru only sends invoices.
        </p>

        <div className="space-y-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            placeholder="nostr+walletconnect://..."
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleConnect}
            disabled={!input.trim() || connecting}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {connecting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Connect'}
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Get a connection string from{' '}
          <span className="font-medium text-zinc-500">Alby, Mutiny, or any NWC-compatible wallet</span>.
        </p>
      </div>
    </div>
  );
}
