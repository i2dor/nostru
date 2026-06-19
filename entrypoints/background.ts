import { executeNip07 } from '../src/core/nip07/execute';
import { getPermission } from '../src/core/store/permissions';
import type { NIP07Method, ApprovalResult, PendingApproval, BridgeNip07Request } from '../src/core/nip07/types';
import { deriveScanPriv, deriveSpendPriv, deriveSpendPub } from '../src/core/nsp';

interface SpRequest {
  type: 'sp:identify' | 'sp:scan' | 'sp:scan_tx' | 'sp:sweep';
  server?: string;
  birthdayHeight?: number;
  tipHeight?: number;
  txid?: string;
  utxos?: unknown[];
  destination?: string;
  feeRate?: number;
}

type IncomingMessage = BridgeNip07Request | ApprovalResult | SpRequest;

const pendingApprovals = new Map<string, {
  resolve: (approved: boolean) => void;
  reject: (e: Error) => void;
}>();

// --- notification system ---

const ALARM_NAME = 'notif-poll';
const POLL_INTERVAL_MINUTES = 5;
const LAST_SEEN_KEY = 'notif_last_seen';
const ACCOUNTS_KEY = 'nostru:accounts';
const RELAYS_KEY = 'relays';
const BLOCKS_KEY = 'blocks';
const ICON_URL = chrome.runtime.getURL('icon/48.png');

const DEFAULT_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
}

interface AccountsStore {
  accounts: { pubkey: string }[];
  activeId: string | null;
}

async function getActivePubkey(): Promise<string | null> {
  const local = await chrome.storage.local.get(ACCOUNTS_KEY);
  const store = local[ACCOUNTS_KEY] as AccountsStore | undefined;
  return store?.activeId ?? store?.accounts[0]?.pubkey ?? null;
}

async function getActivePrivHex(): Promise<string | null> {
  const data = await chrome.storage.session.get('nostru:session');
  const s = data['nostru:session'] as { hex: string } | undefined;
  return s?.hex ?? null;
}

async function getSavedRelays(): Promise<string[]> {
  const result = await chrome.storage.local.get(RELAYS_KEY);
  const saved = result[RELAYS_KEY] as string[] | undefined;
  return saved?.length ? saved : DEFAULT_RELAY_URLS;
}

async function getBlockedPubkeys(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(BLOCKS_KEY);
  return new Set((result[BLOCKS_KEY] as string[] | undefined) ?? []);
}

async function getLastSeen(): Promise<number> {
  const result = await chrome.storage.local.get(LAST_SEEN_KEY);
  return (result[LAST_SEEN_KEY] as number | undefined) ?? 0;
}

async function setLastSeen(ts: number): Promise<void> {
  await chrome.storage.local.set({ [LAST_SEEN_KEY]: ts });
}

function notifTitle(kind: number): string {
  if (kind === 4 || kind === 1059) return 'New message';
  if (kind === 7) return 'New reaction';
  if (kind === 6) return 'New repost';
  if (kind === 9735) return 'New zap';
  return 'New mention';
}

function notifBody(event: NostrEvent): string {
  if (event.kind === 4 || event.kind === 1059) return 'You have a new private message';
  const raw = event.content.trim();
  if (event.kind === 9735) return 'Someone zapped you';
  if (event.kind === 7) return `${raw || '+'} from ${event.pubkey.slice(0, 8)}...`;
  return raw.slice(0, 120) || 'View note';
}

function fetchEventsFromRelay(
  url: string,
  pubkey: string,
  since: number,
  out: NostrEvent[],
): Promise<void> {
  return new Promise(resolve => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve();
      return;
    }

    const subId = 'n1';
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      resolve();
    }, 8000);

    ws.onopen = () => {
      ws.send(JSON.stringify(['REQ', subId, {
        kinds: [1, 4, 6, 7, 1059, 9735],
        '#p': [pubkey],
        since,
        limit: 20,
      }]));
    };

    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data as string) as unknown[];
        if (msg[0] === 'EVENT' && msg[1] === subId) {
          out.push(msg[2] as NostrEvent);
        } else if (msg[0] === 'EOSE') {
          clearTimeout(timer);
          try { ws.close(); } catch { /* ignore */ }
          resolve();
        }
      } catch { /* ignore malformed */ }
    };

    ws.onerror = () => { clearTimeout(timer); resolve(); };
    ws.onclose = () => { clearTimeout(timer); resolve(); };
  });
}

async function checkNotifications(): Promise<void> {
  const pubkey = await getActivePubkey();
  if (!pubkey) return;

  // Keepalive: prevent MV3 service worker from terminating during async WebSocket ops
  const keepalive = setInterval(() => {
    chrome.storage.session.set({ _ka: Date.now() }).catch(() => { /* ignore */ });
  }, 4000);

  try {
    let since = await getLastSeen();
    if (since === 0) {
      // First run: only surface the past hour to avoid a notification flood
      since = Math.floor(Date.now() / 1000) - 3600;
      await setLastSeen(since);
      // Don't return - still fetch from `since` so first-run notifications work
    }

    const [relays, blocked] = await Promise.all([getSavedRelays(), getBlockedPubkeys()]);
    const collected: NostrEvent[] = [];

    await Promise.all(
      relays.slice(0, 3).map(url => fetchEventsFromRelay(url, pubkey, since + 1, collected)),
    );

    // Deduplicate by id; skip own events and blocked pubkeys
    const seen = new Set<string>();
    const fresh = collected.filter(ev => {
      if (seen.has(ev.id)) return false;
      seen.add(ev.id);
      return ev.pubkey !== pubkey && !blocked.has(ev.pubkey);
    });

    fresh.sort((a, b) => a.created_at - b.created_at);

    for (const ev of fresh) {
      chrome.notifications.create(ev.id, {
        type: 'basic',
        iconUrl: ICON_URL,
        title: notifTitle(ev.kind),
        message: notifBody(ev),
      });
    }

    if (fresh.length > 0) {
      const maxTs = Math.max(...fresh.map(ev => ev.created_at));
      await setLastSeen(maxTs);
    }
  } finally {
    clearInterval(keepalive);
  }
}

// --- background entrypoint ---

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // NIP-07 message handler
  chrome.runtime.onMessage.addListener(
    (msg: IncomingMessage, _sender, sendResponse) => {
      if (msg.type === 'nip07-request') {
        handleNip07(msg as BridgeNip07Request)
          .then(result => sendResponse({ result }))
          .catch((err: unknown) =>
            sendResponse({ error: err instanceof Error ? err.message : 'Unknown error' }),
          );
        return true;
      }

      if (msg.type === 'nip07-approval-result') {
        const approval = msg as ApprovalResult;
        const p = pendingApprovals.get(approval.requestId);
        if (p) {
          pendingApprovals.delete(approval.requestId);
          if (approval.approved) p.resolve(true);
          else p.reject(new Error('User denied'));
        }
      }

      if (msg.type === 'sp:identify' || msg.type === 'sp:scan' || msg.type === 'sp:scan_tx' || msg.type === 'sp:sweep') {
        handleSpRequest(msg as SpRequest)
          .then(result => sendResponse({ result }))
          .catch((err: unknown) =>
            sendResponse({ error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }
    },
  );

  // Notification alarm: create if not already scheduled
  chrome.alarms.get(ALARM_NAME, existing => {
    if (!existing) {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: 1,
        periodInMinutes: POLL_INTERVAL_MINUTES,
      });
    }
  });

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_NAME) {
      checkNotifications().catch(() => { /* silent failure */ });
    }
  });

  // Open sidepanel when a notification is clicked
  chrome.notifications.onClicked.addListener(() => {
    chrome.windows.getLastFocused({ populate: false }, win => {
      if (win?.id) chrome.sidePanel.open({ windowId: win.id }).catch(() => { /* ignore */ });
    });
  });

  // Trigger first check immediately after install/update
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: POLL_INTERVAL_MINUTES,
    });
    checkNotifications().catch(() => { /* silent failure */ });
  });
});

function callNativeHost(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const port = chrome.runtime.connectNative('nostru.sp');

    port.onMessage.addListener((msg: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      port.disconnect();
      resolve(msg);
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      settled = true;
      const err = chrome.runtime.lastError;
      reject(new Error(err?.message ?? 'Native host disconnected unexpectedly'));
    });

    port.postMessage(message);
  });
}

async function handleSpRequest(req: SpRequest): Promise<unknown> {
  if (req.type === 'sp:identify') {
    return callNativeHost({ action: 'identify' });
  }

  const privHex = await getActivePrivHex();
  if (!privHex) throw new Error('Nostru locked - unlock first');

  if (req.type === 'sp:scan') {
    const pubkey = await getActivePubkey();
    if (!pubkey) throw new Error('No active account');
    return callNativeHost({
      action:          'scan',
      scan_priv:       deriveScanPriv(privHex),
      spend_pub:       deriveSpendPub(pubkey),
      server:          req.server ?? 'https://silentpayments.xyz/api',
      birthday_height: req.birthdayHeight ?? 0,
      tip_height:      req.tipHeight ?? 0,
    });
  }

  if (req.type === 'sp:scan_tx') {
    const pubkey = await getActivePubkey();
    if (!pubkey) throw new Error('No active account');
    return callNativeHost({
      action:    'scan_tx',
      scan_priv: deriveScanPriv(privHex),
      spend_pub: deriveSpendPub(pubkey),
      txid:      req.txid ?? '',
    });
  }

  if (req.type === 'sp:sweep') {
    return callNativeHost({
      action:      'sweep',
      spend_priv:  deriveSpendPriv(privHex),
      utxos:       req.utxos ?? [],
      destination: req.destination ?? '',
      fee_rate:    req.feeRate ?? 10,
    });
  }

  throw new Error('Unknown sp action');
}

async function handleNip07(msg: BridgeNip07Request): Promise<unknown> {
  const perm = await getPermission(msg.origin);
  if (perm === 'deny') throw new Error('Permission denied for this site');

  // getPublicKey and getRelays don't need the private key
  if (msg.method === 'getPublicKey') {
    const pubkey = await getActivePubkey();
    if (!pubkey) throw new Error('No active account');
    return pubkey;
  }
  if (msg.method === 'getRelays') {
    const data = await chrome.storage.local.get('relays');
    return (data.relays as Record<string, { read: boolean; write: boolean }>) ?? {};
  }

  const privHex = await getActivePrivHex();
  if (!privHex) throw new Error('Wallet locked - unlock Nostru first');

  if (perm !== 'allow') {
    const approved = await promptApproval(msg.id, msg.origin, msg.method);
    if (!approved) throw new Error('User denied');
  }

  return executeNip07(msg.method, msg.params, privHex);
}

async function promptApproval(
  requestId: string,
  origin: string,
  method: NIP07Method,
): Promise<boolean> {
  const pending: PendingApproval = { requestId, origin, method };
  await chrome.storage.session.set({ [`nip07-pending-${requestId}`]: pending });

  const url = `${chrome.runtime.getURL('approval.html')}?requestId=${encodeURIComponent(requestId)}`;
  await chrome.windows.create({ url, type: 'popup', width: 420, height: 320, focused: true });

  return new Promise((resolve, reject) => {
    pendingApprovals.set(requestId, { resolve, reject });
    setTimeout(() => {
      if (pendingApprovals.has(requestId)) {
        pendingApprovals.delete(requestId);
        reject(new Error('Permission request timed out'));
      }
    }, 120_000);
  });
}
