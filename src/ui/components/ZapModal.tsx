import { useState, useCallback } from 'react';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { IconX, IconBolt, IconExternalLink } from '@tabler/icons-react';
import { useNDK } from '../../core/ndk';
import { useProfile } from '../feed/hooks';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { useWallet } from '../context/WalletContext';
import { resolveLud16, fetchInvoice } from '../../core/wallet/lnurl';
import { buildZapRequest } from '../../core/wallet/zap';
import { DEFAULT_RELAYS } from '../../core/ndk/config';

const PRESET_AMOUNTS = [21, 100, 500, 1_000, 5_000];

type ZapState = 'idle' | 'loading' | 'invoice' | 'paid' | 'error';

export function ZapModal({ event, onClose }: { event: NDKEvent; onClose: () => void }) {
  const { ndk } = useNDK();
  const profile = useProfile(event.pubkey);
  const { isConnected, payInvoice } = useWallet();
  const [amountSats, setAmountSats] = useState(21);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<ZapState>('idle');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const displayName = profile?.displayName ?? profile?.name ?? truncateNpub(encodePubkey(event.pubkey));
  const lud16 = profile?.lud16 ?? (profile as Record<string, unknown>)?.['lud06'] as string | undefined;

  const handleZap = useCallback(async () => {
    if (!lud16) { setErrorMsg('Recipient has no Lightning address'); setState('error'); return; }
    setState('loading');
    try {
      const lnurlParams = await resolveLud16(lud16);
      const amountMsats = amountSats * 1000;

      let zapRequestJson: string | undefined;
      if (lnurlParams.allowsNostr && lnurlParams.nostrPubkey && ndk) {
        zapRequestJson = await buildZapRequest(ndk, {
          recipientPubkey: event.pubkey,
          lnurl: lud16,
          amountMsats,
          relayUrls: [...DEFAULT_RELAYS],
          comment: comment || undefined,
          noteId: event.id,
        });
      }

      const bolt11 = await fetchInvoice(lnurlParams.callback, amountMsats, zapRequestJson);

      if (isConnected) {
        await payInvoice(bolt11);
        setState('paid');
      } else {
        setInvoice(bolt11);
        setState('invoice');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Zap failed');
      setState('error');
    }
  }, [lud16, amountSats, comment, ndk, event, isConnected, payInvoice]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <IconBolt size={18} className="text-zap" />
            <span className="font-medium text-sm">Zap {displayName}</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        {state === 'paid' ? (
          <div className="px-4 pb-6 pt-4 text-center space-y-2">
            <div className="text-3xl">⚡</div>
            <p className="font-medium text-sm">Zap sent!</p>
            <p className="text-xs text-zinc-400">{amountSats} sats to {displayName}</p>
            <button onClick={onClose} className="mt-3 w-full py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">Close</button>
          </div>
        ) : state === 'invoice' && invoice ? (
          <div className="px-4 pb-6 pt-2 space-y-3">
            <p className="text-xs text-zinc-500">No wallet connected. Open this invoice in your Lightning app:</p>
            <a
              href={`lightning:${invoice}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-zap/10 text-zap text-sm font-medium hover:bg-zap/20 transition-colors"
            >
              <IconExternalLink size={15} />
              Open in wallet ({amountSats} sats)
            </a>
            <button
              onClick={() => { void navigator.clipboard.writeText(invoice); }}
              className="w-full py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Copy invoice
            </button>
          </div>
        ) : (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {PRESET_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => setAmountSats(amt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    amountSats === amt
                      ? 'bg-zap text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  ⚡ {amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              value={amountSats}
              onChange={e => setAmountSats(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-zap"
              placeholder="Custom amount (sats)"
            />
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-zap resize-none"
              placeholder="Comment (optional)"
            />
            {state === 'error' && (
              <p className="text-xs text-red-500">{errorMsg}</p>
            )}
            <button
              onClick={handleZap}
              disabled={state === 'loading' || !lud16}
              className="w-full py-2.5 rounded-lg bg-zap text-white text-sm font-medium hover:bg-zap/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {state === 'loading' ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <IconBolt size={15} />
                  {isConnected ? `Zap ${amountSats} sats` : 'Get invoice'}
                </>
              )}
            </button>
            {!lud16 && (
              <p className="text-xs text-zinc-400 text-center">This user has no Lightning address</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
