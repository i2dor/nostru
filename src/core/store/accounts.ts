const STORAGE_KEY = 'nostru:accounts';

export interface Account {
  pubkey: string;
  ncryptsec: string;
  displayName?: string;
}

export interface AccountsStore {
  accounts: Account[];
  activeId: string | null;
}

const empty: AccountsStore = { accounts: [], activeId: null };

export async function loadAccounts(): Promise<AccountsStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as AccountsStore | undefined) ?? empty;
}

export async function saveAccounts(store: AccountsStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

export async function upsertAccount(account: Account, makeActive: boolean): Promise<AccountsStore> {
  const store = await loadAccounts();
  const idx = store.accounts.findIndex(a => a.pubkey === account.pubkey);
  if (idx >= 0) {
    store.accounts[idx] = account;
  } else {
    store.accounts.push(account);
  }
  if (makeActive) store.activeId = account.pubkey;
  await saveAccounts(store);
  return store;
}

export async function removeAccount(pubkey: string): Promise<AccountsStore> {
  const store = await loadAccounts();
  store.accounts = store.accounts.filter(a => a.pubkey !== pubkey);
  if (store.activeId === pubkey) {
    store.activeId = store.accounts[0]?.pubkey ?? null;
  }
  await saveAccounts(store);
  return store;
}

export async function setActiveAccount(pubkey: string): Promise<AccountsStore> {
  const store = await loadAccounts();
  store.activeId = pubkey;
  await saveAccounts(store);
  return store;
}
