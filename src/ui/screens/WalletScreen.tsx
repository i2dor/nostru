import { useState, useEffect, useCallback } from 'react';
import {
  IconWallet, IconUnlink, IconBolt, IconScan, IconCopy, IconCheck,
  IconAlertTriangle, IconLoader2, IconBroadcast, IconChevronDown, IconChevronUp,
  IconChevronLeft, IconChevronRight, IconPencil, IconX, IconUpload, IconPlus,
} from '@tabler/icons-react';
import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { useWallet } from '../context/WalletContext';
import { useNDK } from '../../core/ndk';
import { useAccount } from '../context/AccountContext';
import { bytesToHex } from '@noble/hashes/utils.js';
import { deriveNspAddress, derivePaymentPriv, privToXonlyPubHex } from '../../core/nsp';
import { getCustomSpAddress, setCustomSpAddress } from '../../core/store/customSp';
import { generatePaymentPriv, savePaymentKey, loadPaymentKey, clearPaymentKey } from '../../core/store/paymentKey';
import { publishNip352Address } from '../../core/events/nip352';
import { getIdentityIndex, setIdentityIndex } from '../../core/store/identityIndex';
import type { PaymentMode } from '../../core/sp/scanKeys';
import { InfoTip } from '../components/InfoTip';

// ── NWC Wallet ────────────────────────────────────────────────────────────

function NwcSection() {
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

  if (isConnected) {
    return (
      <div className="px-4 py-6 space-y-6 border-b border-zinc-100 dark:border-zinc-800">
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
          onClick={() => void disconnect()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <IconUnlink size={15} />
          Disconnect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-5 border-b border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center gap-2 text-zinc-500">
        <IconWallet size={20} />
        <span className="text-sm font-medium">Connect a wallet</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Paste a NWC connection string to enable one-click zaps. Your wallet stays in control of
        funds - Nostru only sends invoices.
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
          onClick={() => void handleConnect()}
          disabled={!input.trim() || connecting}
          className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {connecting
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : 'Connect'}
        </button>
      </div>
      <p className="text-xs text-zinc-400">
        Get a connection string from{' '}
        <span className="font-medium text-zinc-500">Alby, Mutiny, or any NWC-compatible wallet</span>.
      </p>
    </div>
  );
}

// ── Silent Payments ───────────────────────────────────────────────────────

interface SpUtxo {
  txid: string;
  vout: number;
  value: number;
  x_only_pubkey: string;
  k: number;
  block_height: number;
  shared_secret: string;
}

interface SweepResult {
  rawTx: string;
  feeSats: number;
  amountSats: number;
}

type SpStatus = 'checking' | 'not-installed' | 'ready' | 'error';

function sendToBackground(msg: Record<string, unknown>): Promise<{ result?: unknown; error?: string }> {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
    >
      {copied ? <IconCheck size={12} className="text-green-500" /> : <IconCopy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function SpSection() {
  const { ndk } = useNDK();
  const { session } = useAccount();

  const [status, setStatus] = useState<SpStatus>('checking');
  const [statusErr, setStatusErr] = useState('');
  const [open, setOpen] = useState(false);

  const [server, setServer] = useState('https://silentpayments.xyz/api');
  const [birthday, setBirthday] = useState('');
  const [tip, setTip] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const [txid, setTxid] = useState('');
  const [scanningTx, setScanningTx] = useState(false);
  const [scanTxErr, setScanTxErr] = useState('');
  const [explorer, setExplorer] = useState('https://mempool.space');
  const [scanningEsplora, setScanningEsplora] = useState(false);
  const [scanEsploraErr, setScanEsploraErr] = useState('');
  const [frigateServer, setFrigateServer] = useState('');
  const [scanningFrigate, setScanningFrigate] = useState(false);
  const [scanFrigateErr, setScanFrigateErr] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoverErr, setDiscoverErr] = useState('');
  const [utxos, setUtxos] = useState<SpUtxo[]>([]);

  const [dest, setDest] = useState('');
  const [feeRate, setFeeRate] = useState('5');
  const [sweeping, setSweeping] = useState(false);
  const [sweepErr, setSweepErr] = useState('');
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState('');

  const [customSpAddress, setCustomSpAddressState] = useState<string | null>(null);
  const [editingSpAddr, setEditingSpAddr] = useState(false);
  const [spAddrDraft, setSpAddrDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishErr, setPublishErr] = useState('');
  const [publishedAt, setPublishedAt] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('social');
  const [indepPrivHex, setIndepPrivHex] = useState<string | null>(null);
  const [identityIndex, setIdentityIndexState] = useState(1);
  const [indexLoaded, setIndexLoaded] = useState(false);

  const pubkey = session.status === 'unlocked' ? session.account.pubkey : '';
  const derivedSpAddress = (() => {
    if (!pubkey) return null;
    try {
      if (paymentMode === 'deterministic' && session.status === 'unlocked') {
        const privHex = bytesToHex(session.privkey);
        return deriveNspAddress(privToXonlyPubHex(derivePaymentPriv(privHex, identityIndex)));
      }
      if (paymentMode === 'independent') {
        return indepPrivHex ? deriveNspAddress(privToXonlyPubHex(indepPrivHex)) : null;
      }
      return deriveNspAddress(pubkey);
    } catch { return null; }
  })();
  const displaySpAddress = customSpAddress ?? derivedSpAddress;

  useEffect(() => {
    if (pubkey) getCustomSpAddress(pubkey).then(setCustomSpAddressState);
  }, [pubkey]);

  useEffect(() => {
    if (paymentMode !== 'independent' || session.status !== 'unlocked') { setIndepPrivHex(null); return; }
    const socialPrivHex = bytesToHex(session.privkey);
    loadPaymentKey(pubkey, socialPrivHex).then(setIndepPrivHex).catch(() => setIndepPrivHex(null));
  }, [paymentMode, session, pubkey]);

  useEffect(() => {
    if (paymentMode !== 'deterministic' || session.status !== 'unlocked' || !pubkey) return;
    setIndexLoaded(false);
    getIdentityIndex(pubkey).then(n => { setIdentityIndexState(n); setIndexLoaded(true); });
  }, [paymentMode, session.status, pubkey]);

  const saveSpAddr = useCallback(async () => {
    const trimmed = spAddrDraft.trim();
    await setCustomSpAddress(pubkey, trimmed || null);
    setCustomSpAddressState(trimmed || null);
    setEditingSpAddr(false);
  }, [pubkey, spAddrDraft]);

  const handlePublish = useCallback(async () => {
    if (!ndk || !displaySpAddress || session.status !== 'unlocked') return;
    setPublishErr('');
    setPublishing(true);
    try {
      let paymentPubkeyHex: string | undefined;
      if (paymentMode === 'deterministic') {
        paymentPubkeyHex = privToXonlyPubHex(derivePaymentPriv(bytesToHex(session.privkey), identityIndex));
      } else if (paymentMode === 'independent' && indepPrivHex) {
        paymentPubkeyHex = privToXonlyPubHex(indepPrivHex);
      }
      await publishNip352Address(ndk, displaySpAddress, 'mainnet', paymentPubkeyHex);
      setPublishedAt(Math.floor(Date.now() / 1000));
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [ndk, displaySpAddress, session, paymentMode, indepPrivHex, identityIndex]);

  const handleGenerateKey = useCallback(async () => {
    if (session.status !== 'unlocked') return;
    const privHex = generatePaymentPriv();
    await savePaymentKey(pubkey, privHex, bytesToHex(session.privkey));
    setIndepPrivHex(privHex);
    setPublishedAt(null);
  }, [session, pubkey]);

  const handleRevokeKey = useCallback(async () => {
    await clearPaymentKey(pubkey);
    setIndepPrivHex(null);
    setPublishedAt(null);
  }, [pubkey]);

  const handleStepIndex = useCallback(async (delta: number) => {
    const next = Math.max(1, identityIndex + delta);
    setIdentityIndexState(next);
    try {
      await setIdentityIndex(pubkey, next);
      setPublishedAt(null);
    } catch {
      setIdentityIndexState(identityIndex);
    }
  }, [identityIndex, pubkey]);

  const handleNewIdentity = useCallback(async () => {
    if (!ndk || session.status !== 'unlocked') return;
    const next = identityIndex + 1;
    setIdentityIndexState(next);
    await setIdentityIndex(pubkey, next);
    setPublishedAt(null);
    setPublishErr('');
    setPublishing(true);
    try {
      const privHex = bytesToHex(session.privkey);
      const payPriv = derivePaymentPriv(privHex, next);
      const addr = deriveNspAddress(privToXonlyPubHex(payPriv));
      await publishNip352Address(ndk, addr, 'mainnet', privToXonlyPubHex(payPriv));
      setPublishedAt(Math.floor(Date.now() / 1000));
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [ndk, session, identityIndex, pubkey]);

  const extensionId = chrome.runtime.id;
  const installCmd = `python3 install.py --extension-id=${extensionId}`;

  useEffect(() => {
    sendToBackground({ type: 'sp:identify' }).then(res => {
      if (res?.error) {
        setStatus('not-installed');
      } else {
        setStatus('ready');
      }
    }).catch(() => setStatus('not-installed'));
  }, []);

  const handleScan = useCallback(async () => {
    setScanErr('');
    setUtxos([]);
    setSweepResult(null);
    setScanning(true);
    try {
      const res = await sendToBackground({
        type:          'sp:scan',
        server,
        birthdayHeight: birthday ? parseInt(birthday, 10) : 0,
        tipHeight:      tip      ? parseInt(tip, 10)      : 0,
        paymentMode,
        paymentIndex:  identityIndex,
      });
      if (res?.error) { setScanErr(res.error); return; }
      const data = res?.result as { status: string; utxos?: SpUtxo[]; error?: string };
      if (data?.status === 'ok') setUtxos(data.utxos ?? []);
      else setScanErr(data?.error ?? 'Unexpected response from native host');
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [server, birthday, tip, paymentMode, identityIndex]);

  const handleScanTx = useCallback(async () => {
    setScanTxErr('');
    setUtxos([]);
    setSweepResult(null);
    setScanningTx(true);
    try {
      const res = await sendToBackground({ type: 'sp:scan_tx', txid: txid.trim(), paymentMode, paymentIndex: identityIndex });
      if (res?.error) { setScanTxErr(res.error); return; }
      const data = res?.result as { status: string; utxos?: SpUtxo[]; error?: string };
      if (data?.status === 'ok') setUtxos(data.utxos ?? []);
      else setScanTxErr(data?.error ?? 'Unexpected response from native host');
    } catch (e) {
      setScanTxErr(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanningTx(false);
    }
  }, [txid, paymentMode, identityIndex]);

  const handleScanEsplora = useCallback(async () => {
    setScanEsploraErr('');
    setUtxos([]);
    setSweepResult(null);
    setScanningEsplora(true);
    try {
      const res = await sendToBackground({
        type:           'sp:scan_esplora',
        explorer:       explorer.trim() || 'https://mempool.space',
        birthdayHeight: birthday ? parseInt(birthday, 10) : 0,
        tipHeight:      tip      ? parseInt(tip, 10)      : 0,
        paymentMode,
        paymentIndex:  identityIndex,
      });
      if (res?.error) { setScanEsploraErr(res.error); return; }
      const data = res?.result as { status: string; utxos?: SpUtxo[]; error?: string };
      if (data?.status === 'ok') setUtxos(data.utxos ?? []);
      else setScanEsploraErr(data?.error ?? 'Unexpected response from native host');
    } catch (e) {
      setScanEsploraErr(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanningEsplora(false);
    }
  }, [explorer, birthday, tip, paymentMode, identityIndex]);

  const handleScanFrigate = useCallback(async () => {
    setScanFrigateErr('');
    setUtxos([]);
    setSweepResult(null);
    setScanningFrigate(true);
    try {
      const res = await sendToBackground({
        type:           'sp:scan_frigate',
        frigateServer:  frigateServer.trim(),
        birthdayHeight: birthday ? parseInt(birthday, 10) : 0,
        paymentMode,
        paymentIndex:  identityIndex,
      });
      if (res?.error) { setScanFrigateErr(res.error); return; }
      const data = res?.result as { status: string; utxos?: SpUtxo[]; error?: string };
      if (data?.status === 'ok') setUtxos(data.utxos ?? []);
      else setScanFrigateErr(data?.error ?? 'Unexpected response from native host');
    } catch (e) {
      setScanFrigateErr(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanningFrigate(false);
    }
  }, [frigateServer, birthday, paymentMode, identityIndex]);

  const handleDiscover = useCallback(async () => {
    if (!ndk || session.status !== 'unlocked') return;
    const pubkey = session.account.pubkey;

    setDiscovering(true);
    setDiscoverErr('');
    try {
      // Fetch up to 500 recent events from relays; take the oldest timestamp
      // as an approximation of when this npub first appeared.
      const events = await ndk.fetchEvents(
        { authors: [pubkey], limit: 500 },
        { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY },
      );
      if (!events.size) throw new Error('No events found on connected relays');

      const oldestTs = [...events].reduce(
        (min, ev) => Math.min(min, ev.created_at ?? Infinity),
        Infinity,
      );
      if (!isFinite(oldestTs)) throw new Error('Could not read event timestamps');

      // Apply a 1-week safety margin: npub may have been shared before first event.
      const safeTs = Math.max(0, oldestTs - 7 * 24 * 3600);

      const res = await fetch(`https://mempool.space/api/v1/mining/blocks/timestamp/${safeTs}`);
      if (!res.ok) throw new Error(`Block lookup failed: ${res.status}`);
      const data = await res.json() as { height: number };

      setBirthday(String(data.height));
    } catch (e) {
      setDiscoverErr(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }, [ndk, session]);

  const handleSweep = useCallback(async () => {
    if (!dest.trim() || utxos.length === 0) return;
    setSweepErr('');
    setSweepResult(null);
    setBroadcastResult('');
    setSweeping(true);
    try {
      const res = await sendToBackground({
        type:         'sp:sweep',
        utxos,
        destination:  dest.trim(),
        feeRate:      parseInt(feeRate, 10) || 5,
        paymentMode,
        paymentIndex: identityIndex,
      });
      if (res?.error) { setSweepErr(res.error); return; }
      const data = res?.result as { status: string; raw_tx: string; fee_sats: number; amount_sats: number };
      if (data?.status === 'ok') {
        setSweepResult({ rawTx: data.raw_tx, feeSats: data.fee_sats, amountSats: data.amount_sats });
      } else {
        setSweepErr('Unexpected response from native host');
      }
    } catch (e) {
      setSweepErr(e instanceof Error ? e.message : 'Sweep failed');
    } finally {
      setSweeping(false);
    }
  }, [utxos, dest, feeRate, paymentMode, identityIndex]);

  const handleBroadcast = useCallback(async () => {
    if (!sweepResult) return;
    setBroadcasting(true);
    setBroadcastResult('');
    try {
      const res = await fetch('https://mempool.space/api/tx', {
        method: 'POST',
        body: sweepResult.rawTx,
      });
      const text = await res.text();
      if (res.ok) {
        setBroadcastResult(`Broadcast OK: txid ${text.trim()}`);
      } else {
        setBroadcastResult(`Error: ${text.trim()}`);
      }
    } catch (e) {
      setBroadcastResult(e instanceof Error ? e.message : 'Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  }, [sweepResult]);

  const totalSats = utxos.reduce((s, u) => s + u.value, 0);

  return (
    <div className="px-4 py-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <IconScan size={16} className="text-zinc-400" />
          <span className="text-sm font-medium">Silent Payments (NSP)</span>
          <InfoTip text="NSP lets you receive Bitcoin silently. Your SP address is derived from your Nostr key - no address exchange needed. Senders pay you; you scan locally to detect UTXOs." />
          {status === 'checking' && <IconLoader2 size={13} className="animate-spin text-zinc-400" />}
          {status === 'not-installed' && <IconAlertTriangle size={13} className="text-amber-400" />}
          {status === 'ready' && utxos.length > 0 && (
            <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
              {utxos.length} UTXO{utxos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <IconChevronUp size={14} className="text-zinc-400" /> : <IconChevronDown size={14} className="text-zinc-400" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {displaySpAddress && !editingSpAddr && (
            <div className="space-y-1">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <span className="text-xs font-mono text-zinc-500 truncate flex-1" title={displaySpAddress}>
                {displaySpAddress.slice(0, 20)}...
              </span>
              {customSpAddress && (
                <span className="text-[10px] text-amber-500 shrink-0">custom</span>
              )}
              <CopyButton text={displaySpAddress} />
              <button
                onClick={() => { setSpAddrDraft(customSpAddress ?? ''); setEditingSpAddr(true); }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0"
                title="Set custom SP address"
              >
                <IconPencil size={12} />
              </button>
              {customSpAddress && (
                <button
                  onClick={async () => { await setCustomSpAddress(pubkey, null); setCustomSpAddressState(null); }}
                  className="text-zinc-400 hover:text-red-400 shrink-0"
                  title="Reset to derived address"
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={() => void handlePublish()}
                disabled={publishing || !ndk || session.status !== 'unlocked'}
                className="text-xs text-accent hover:underline disabled:opacity-40 flex items-center gap-1"
              >
                {publishing
                  ? <><IconLoader2 size={10} className="animate-spin" />Publishing...</>
                  : <><IconUpload size={10} />Publish to Nostr (NIP-352)</>}
              </button>
              <InfoTip text="Publishes your SP address as a kind:10352 Nostr event. Senders who query your npub will find this address instead of computing it from your key. Required for deterministic and independent modes." />
              {publishedAt && !publishing && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <IconCheck size={10} />Published
                </span>
              )}
              {publishErr && <span className="text-xs text-red-500">{publishErr}</span>}
            </div>
            <div className="flex items-center gap-1.5 px-1 flex-wrap">
              <span className="text-xs text-zinc-400">Identity:</span>
              <InfoTip text="Social: SP address derived from your Nostr key. Anyone can compute it from your npub. Det.: separate address derived from your key + an index, recoverable from the same seed. Indep.: fully separate keypair, maximum separation, requires its own backup." />
              {(['social', 'deterministic', 'independent'] as const).map(m => (
                <button key={m} onClick={() => { setPaymentMode(m); setPublishedAt(null); }}
                  title={m === 'social' ? 'SP address derived directly from your Nostr key' : m === 'deterministic' ? 'Separate SP address derived from your key + an index number' : 'SP address from a fully independent keypair'}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${paymentMode === m ? 'border-accent text-accent bg-accent/10' : 'border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:text-accent'}`}>
                  {m === 'social' ? 'Social' : m === 'deterministic' ? 'Det.' : 'Indep.'}
                </button>
              ))}
            </div>
            {paymentMode === 'deterministic' && (
              <div className="flex items-center gap-2 px-1 flex-wrap">
                <button
                  onClick={() => void handleStepIndex(-1)}
                  disabled={!indexLoaded || identityIndex <= 1}
                  className="p-0.5 rounded text-zinc-400 hover:text-accent disabled:opacity-30 transition-colors"
                  title="Previous identity"
                >
                  <IconChevronLeft size={14} />
                </button>
                <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300 w-4 text-center">{identityIndex}</span>
                <button
                  onClick={() => void handleStepIndex(1)}
                  disabled={!indexLoaded}
                  className="p-0.5 rounded text-zinc-400 hover:text-accent disabled:opacity-30 transition-colors"
                  title="Next identity"
                >
                  <IconChevronRight size={14} />
                </button>
                <button
                  onClick={() => void handleNewIdentity()}
                  disabled={!indexLoaded || publishing || !ndk || session.status !== 'unlocked'}
                  className="flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-40 ml-1"
                >
                  <IconPlus size={10} />New identity
                </button>
              </div>
            )}
            {paymentMode === 'independent' && (
              <div className="px-1">
                {indepPrivHex ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">{privToXonlyPubHex(indepPrivHex).slice(0, 16)}...</span>
                    <button onClick={() => void handleRevokeKey()} className="text-xs text-red-400 hover:text-red-500">Revoke</button>
                  </div>
                ) : (
                  <button onClick={() => void handleGenerateKey()} disabled={session.status !== 'unlocked'}
                    className="text-xs text-accent hover:underline disabled:opacity-40">
                    Generate payment keypair
                  </button>
                )}
              </div>
            )}
            </div>
          )}
          {editingSpAddr && (
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 block">
                Custom SP address{' '}
                <span className="text-zinc-300 dark:text-zinc-600">(leave blank to use derived)</span>
              </label>
              <input
                value={spAddrDraft}
                onChange={e => setSpAddrDraft(e.target.value)}
                placeholder={derivedSpAddress ?? 'sp1...'}
                className="w-full px-2 py-1.5 text-xs font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2">
                <button onClick={() => void saveSpAddr()} className="text-xs px-3 py-1 rounded-full bg-accent text-white hover:bg-accent/90">Save</button>
                <button onClick={() => setEditingSpAddr(false)} className="text-xs px-3 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:text-zinc-700 flex items-center gap-1"><IconX size={10} /> Cancel</button>
                {customSpAddress && (
                  <button onClick={async () => { await setCustomSpAddress(pubkey, null); setCustomSpAddressState(null); setEditingSpAddr(false); }} className="text-xs text-red-400 hover:text-red-500 ml-auto">Reset to derived</button>
                )}
              </div>
            </div>
          )}
          {status === 'not-installed' && (
            <div className="space-y-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Native host not found. Install it to enable scanning.
              </p>
              <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
                <li>
                  Clone the repo:{' '}
                  <code className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                    git clone https://github.com/i2dor/nostru
                  </code>
                </li>
                <li>
                  Run:{' '}
                  <code className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                    cd nostru/tools/nostru-sp
                  </code>
                </li>
                <li>
                  Install with your extension ID:
                </li>
              </ol>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 rounded break-all">
                  {installCmd}
                </code>
                <CopyButton text={installCmd} />
              </div>
              <p className="text-xs text-zinc-500">
                Extension ID:{' '}
                <code className="font-mono text-[10px]">{extensionId}</code>
              </p>
              <button
                onClick={() => {
                  setStatus('checking');
                  sendToBackground({ type: 'sp:identify' }).then(res => {
                    setStatus(res?.error ? 'not-installed' : 'ready');
                  }).catch(() => setStatus('not-installed'));
                }}
                className="text-xs text-accent hover:underline"
              >
                Re-check after installing
              </button>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">SP index server</label>
                <input
                  type="url"
                  value={server}
                  onChange={e => setServer(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Esplora endpoint <span className="text-zinc-400 font-normal">(max 20 blocks, no index needed)</span></label>
                <input
                  type="url"
                  value={explorer}
                  onChange={e => setExplorer(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="flex items-center gap-1 text-xs text-zinc-400 mb-1">Birthday height <InfoTip text="The block height when you first used this SP address. Scanning starts here. Set it too early and you scan more blocks than needed; set it too late and you miss payments. Write it down when you share your address." /></label>
                  <input
                    type="number"
                    value={birthday}
                    onChange={e => setBirthday(e.target.value)}
                    placeholder="e.g. 840000"
                    className="w-full px-2 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={() => void handleDiscover()}
                    disabled={discovering || !ndk || session.status !== 'unlocked'}
                    className="mt-1 text-xs text-accent hover:underline disabled:opacity-40 flex items-center gap-1"
                  >
                    {discovering
                      ? <><IconLoader2 size={10} className="animate-spin" />Discovering...</>
                      : 'Discover from relays'}
                  </button>
                  {discoverErr && <p className="text-xs text-red-500 mt-0.5">{discoverErr}</p>}
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-1 text-xs text-zinc-400 mb-1">Tip height (opt) <InfoTip text="Stop scanning at this block height. Leave blank to scan to the current chain tip. Useful to limit scan time or reproduce a scan at a specific point in history." /></label>
                  <input
                    type="number"
                    value={tip}
                    onChange={e => setTip(e.target.value)}
                    placeholder="current"
                    className="w-full px-2 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
              <button
                onClick={() => void handleScan()}
                disabled={scanning}
                className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {scanning
                  ? <><IconLoader2 size={14} className="animate-spin" /> Scanning...</>
                  : <><IconScan size={14} /> Scan for payments</>}
              </button>
              {scanErr && <p className="text-xs text-red-500">{scanErr}</p>}
              <button
                onClick={() => void handleScanEsplora()}
                disabled={scanningEsplora}
                className="w-full py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {scanningEsplora
                  ? <><IconLoader2 size={14} className="animate-spin" /> Scanning blocks...</>
                  : <><IconScan size={14} /> Scan via Esplora</>}
              </button>
              {scanEsploraErr && <p className="text-xs text-red-500">{scanEsploraErr}</p>}

              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Frigate server <span className="text-zinc-400 font-normal">(Electrum SP index, e.g. sparrowwallet)</span></label>
                <input
                  type="text"
                  value={frigateServer}
                  onChange={e => setFrigateServer(e.target.value)}
                  placeholder="ssl://host:50002 or tcp://host:50001"
                  className="w-full px-2 py-1.5 text-xs font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <button
                onClick={() => void handleScanFrigate()}
                disabled={scanningFrigate || !frigateServer.trim()}
                className="w-full py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {scanningFrigate
                  ? <><IconLoader2 size={14} className="animate-spin" /> Scanning via Frigate...</>
                  : <><IconScan size={14} /> Scan via Frigate</>}
              </button>
              {scanFrigateErr && <p className="text-xs text-red-500">{scanFrigateErr}</p>}

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
                <label className="block text-xs text-zinc-400">Or scan a specific transaction</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={txid}
                    onChange={e => setTxid(e.target.value)}
                    placeholder="txid (64 hex chars)"
                    className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={() => void handleScanTx()}
                    disabled={scanningTx || !txid.trim()}
                    className="px-3 py-1.5 rounded border border-accent text-accent text-xs font-medium hover:bg-accent/10 disabled:opacity-40 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    {scanningTx
                      ? <><IconLoader2 size={12} className="animate-spin" /> Checking...</>
                      : <><IconScan size={12} /> Check tx</>}
                  </button>
                </div>
                {scanTxErr && <p className="text-xs text-red-500">{scanTxErr}</p>}
              </div>

              {utxos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500">
                    Found {utxos.length} UTXO{utxos.length !== 1 ? 's' : ''} - total{' '}
                    <span className="text-zinc-700 dark:text-zinc-300">{totalSats.toLocaleString()} sats</span>
                  </p>
                  <ul className="space-y-1">
                    {utxos.map(u => (
                      <li key={`${u.txid}:${u.vout}`} className="flex items-center justify-between text-xs font-mono bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5">
                        <span className="text-zinc-500 truncate max-w-[120px]">{u.txid.slice(0, 10)}...:{u.vout}</span>
                        <span className="text-zinc-700 dark:text-zinc-300 tabular-nums">{u.value.toLocaleString()} sats</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2 space-y-2 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500">Sweep all to address</p>
                    <input
                      type="text"
                      value={dest}
                      onChange={e => setDest(e.target.value)}
                      placeholder="bc1p... (any Bitcoin address)"
                      className="w-full px-2 py-1.5 text-xs font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-400 shrink-0">Fee rate (sat/vB)</label>
                      <input
                        type="number"
                        value={feeRate}
                        onChange={e => setFeeRate(e.target.value)}
                        min="1"
                        className="w-20 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <button
                      onClick={() => void handleSweep()}
                      disabled={sweeping || !dest.trim()}
                      className="w-full py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {sweeping
                        ? <><IconLoader2 size={14} className="animate-spin" /> Building TX...</>
                        : 'Build sweep transaction'}
                    </button>
                    {sweepErr && <p className="text-xs text-red-500">{sweepErr}</p>}
                  </div>

                  {sweepResult && (
                    <div className="space-y-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Amount sent</span>
                        <span className="font-medium tabular-nums">{sweepResult.amountSats.toLocaleString()} sats</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Fee</span>
                        <span className="tabular-nums text-zinc-400">{sweepResult.feeSats.toLocaleString()} sats</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <CopyButton text={sweepResult.rawTx} label="Copy raw TX" />
                        <button
                          onClick={() => void handleBroadcast()}
                          disabled={broadcasting}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                        >
                          {broadcasting
                            ? <IconLoader2 size={12} className="animate-spin" />
                            : <IconBroadcast size={12} />}
                          Broadcast
                        </button>
                      </div>
                      {broadcastResult && (
                        <p className={`text-xs break-all ${broadcastResult.startsWith('Broadcast OK') ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {broadcastResult}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!scanning && utxos.length === 0 && !scanErr && (
                <p className="text-xs text-zinc-400 text-center py-2">
                  No payments found yet. Try scanning from a lower birthday height.
                </p>
              )}
            </div>
          )}

          {statusErr && <p className="text-xs text-red-500">{statusErr}</p>}
        </div>
      )}
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export function WalletScreen() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <NwcSection />
      <SpSection />
    </div>
  );
}
