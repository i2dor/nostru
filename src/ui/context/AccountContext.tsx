import { createContext, useContext, useEffect, useReducer, useCallback, type ReactNode } from 'react';
import {
  generateKeypair,
  derivePubkey,
  bytesToHex,
  encryptKey,
  decryptKey,
  isNcryptsec,
  encodePubkey,
  parsePrivkey,
} from '../../core/keys';
import {
  loadAccounts,
  upsertAccount,
  removeAccount,
  setActiveAccount,
  type Account,
  type AccountsStore,
} from '../../core/store';

// --- session cache (chrome.storage.session - in-memory, cleared on browser close) ---

const SESSION_STORAGE_KEY = 'nostru:session';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function saveSession(pubkey: string, privkey: Uint8Array): Promise<void> {
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: { pubkey, hex: bytesToHex(privkey) } });
}

function clearSession(): void {
  chrome.storage.session.remove(SESSION_STORAGE_KEY);
}

async function restoreSession(): Promise<{ pubkey: string; privkey: Uint8Array } | null> {
  const result = await chrome.storage.session.get(SESSION_STORAGE_KEY);
  const cached = result[SESSION_STORAGE_KEY] as { pubkey: string; hex: string } | undefined;
  if (!cached) return null;
  return { pubkey: cached.pubkey, privkey: hexToBytes(cached.hex) };
}

// --- state ---

type Session =
  | { status: 'loading' }
  | { status: 'onboarding' }
  | { status: 'locked'; account: Account; allAccounts: Account[] }
  | { status: 'unlocked'; account: Account; allAccounts: Account[]; privkey: Uint8Array };

type Action =
  | { type: 'LOADED'; store: AccountsStore }
  | { type: 'UNLOCKED'; privkey: Uint8Array }
  | { type: 'LOCKED' }
  | { type: 'STORE_UPDATED'; store: AccountsStore };

function activeAccount(store: AccountsStore): Account | undefined {
  return store.accounts.find(a => a.pubkey === store.activeId) ?? store.accounts[0];
}

export function accountReducer(state: Session, action: Action): Session {
  switch (action.type) {
    case 'LOADED': {
      if (action.store.accounts.length === 0) return { status: 'onboarding' };
      const account = activeAccount(action.store)!;
      return { status: 'locked', account, allAccounts: action.store.accounts };
    }
    case 'STORE_UPDATED': {
      if (action.store.accounts.length === 0) return { status: 'onboarding' };
      const account = activeAccount(action.store)!;
      if (state.status === 'unlocked' && state.account.pubkey === account.pubkey) {
        return { ...state, account, allAccounts: action.store.accounts };
      }
      return { status: 'locked', account, allAccounts: action.store.accounts };
    }
    case 'UNLOCKED': {
      if (state.status !== 'locked') return state;
      return { status: 'unlocked', account: state.account, allAccounts: state.allAccounts, privkey: action.privkey };
    }
    case 'LOCKED': {
      if (state.status !== 'unlocked') return state;
      return { status: 'locked', account: state.account, allAccounts: state.allAccounts };
    }
  }
}

// --- context ---

interface AccountContextValue {
  session: Session;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  createAccount: (password: string) => Promise<void>;
  importKey: (input: string, password: string) => Promise<void>;
  switchAccount: (pubkey: string) => Promise<void>;
  deleteAccount: (pubkey: string) => Promise<void>;
}

const Ctx = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, dispatch] = useReducer(accountReducer, { status: 'loading' });

  useEffect(() => {
    (async () => {
      const [store, cached] = await Promise.all([loadAccounts(), restoreSession()]);
      dispatch({ type: 'LOADED', store });
      if (cached) {
        const account = activeAccount(store);
        if (account && account.pubkey === cached.pubkey) {
          dispatch({ type: 'UNLOCKED', privkey: cached.privkey });
        }
      }
    })();
  }, []);

  const unlock = useCallback(async (password: string) => {
    if (session.status !== 'locked') return;
    const privkey = decryptKey(session.account.ncryptsec, password);
    await saveSession(session.account.pubkey, privkey);
    dispatch({ type: 'UNLOCKED', privkey });
  }, [session]);

  const lock = useCallback(() => {
    clearSession();
    dispatch({ type: 'LOCKED' });
  }, []);

  const createAccount = useCallback(async (password: string) => {
    const { privkey, pubkey } = generateKeypair();
    const ncryptsec = encryptKey(privkey, password);
    const account: Account = { pubkey, ncryptsec };
    const store = await upsertAccount(account, true);
    dispatch({ type: 'STORE_UPDATED', store });
    await saveSession(pubkey, privkey);
    dispatch({ type: 'UNLOCKED', privkey });
  }, []);

  const importKey = useCallback(async (input: string, password: string) => {
    const trimmed = input.trim();
    let privkey: Uint8Array;
    let ncryptsec: string;

    if (isNcryptsec(trimmed)) {
      privkey = decryptKey(trimmed, password);
      ncryptsec = trimmed;
    } else {
      privkey = parsePrivkey(trimmed);
      ncryptsec = encryptKey(privkey, password);
    }

    const pubkey = derivePubkey(privkey);
    const account: Account = { pubkey, ncryptsec };
    const store = await upsertAccount(account, true);
    dispatch({ type: 'STORE_UPDATED', store });
    await saveSession(pubkey, privkey);
    dispatch({ type: 'UNLOCKED', privkey });
  }, []);

  const switchAccount = useCallback(async (pubkey: string) => {
    clearSession();
    const store = await setActiveAccount(pubkey);
    dispatch({ type: 'STORE_UPDATED', store });
  }, []);

  const deleteAccount = useCallback(async (pubkey: string) => {
    const store = await removeAccount(pubkey);
    dispatch({ type: 'STORE_UPDATED', store });
  }, []);

  return (
    <Ctx.Provider value={{ session, unlock, lock, createAccount, importKey, switchAccount, deleteAccount }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}

export function useNpub(): string | null {
  const { session } = useAccount();
  if (session.status !== 'locked' && session.status !== 'unlocked') return null;
  return encodePubkey(session.account.pubkey);
}

export function usePrivkey(): Uint8Array | null {
  const { session } = useAccount();
  if (session.status !== 'unlocked') return null;
  return session.privkey;
}

export { bytesToHex };
