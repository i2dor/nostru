import { describe, it, expect } from 'vitest';
import { accountReducer } from './AccountContext';

const MOCK_PRIVKEY = new Uint8Array(32).fill(1);

const ACCOUNT_A = { pubkey: 'a'.repeat(64), ncryptsec: 'ncryptsec1test' };
const ACCOUNT_B = { pubkey: 'b'.repeat(64), ncryptsec: 'ncryptsec1test2' };
const ALL = [ACCOUNT_A, ACCOUNT_B];

const LOCKED_A = { status: 'locked' as const, account: ACCOUNT_A, allAccounts: ALL };
const UNLOCKED_A = { status: 'unlocked' as const, account: ACCOUNT_A, allAccounts: ALL, privkey: MOCK_PRIVKEY };

describe('accountReducer', () => {
  it('LOADED with no accounts -> onboarding', () => {
    const next = accountReducer({ status: 'loading' }, { type: 'LOADED', store: { accounts: [], activeId: null } });
    expect(next.status).toBe('onboarding');
  });

  it('LOADED with accounts -> locked on active account', () => {
    const next = accountReducer({ status: 'loading' }, { type: 'LOADED', store: { accounts: ALL, activeId: ACCOUNT_B.pubkey } });
    expect(next.status).toBe('locked');
    if (next.status === 'locked') expect(next.account.pubkey).toBe(ACCOUNT_B.pubkey);
  });

  it('UNLOCKED from locked -> unlocked', () => {
    const next = accountReducer(LOCKED_A, { type: 'UNLOCKED', privkey: MOCK_PRIVKEY });
    expect(next.status).toBe('unlocked');
    if (next.status === 'unlocked') expect(next.privkey).toBe(MOCK_PRIVKEY);
  });

  it('UNLOCKED from non-locked state -> no change', () => {
    const state = { status: 'onboarding' as const };
    expect(accountReducer(state, { type: 'UNLOCKED', privkey: MOCK_PRIVKEY })).toBe(state);
  });

  it('LOCKED from unlocked -> locked', () => {
    const next = accountReducer(UNLOCKED_A, { type: 'LOCKED' });
    expect(next.status).toBe('locked');
  });

  it('LOCKED from non-unlocked state -> no change', () => {
    expect(accountReducer(LOCKED_A, { type: 'LOCKED' })).toBe(LOCKED_A);
  });

  it('STORE_UPDATED preserves unlocked status when same account stays active', () => {
    const next = accountReducer(UNLOCKED_A, { type: 'STORE_UPDATED', store: { accounts: ALL, activeId: ACCOUNT_A.pubkey } });
    expect(next.status).toBe('unlocked');
    if (next.status === 'unlocked') expect(next.privkey).toBe(MOCK_PRIVKEY);
  });

  it('STORE_UPDATED reverts to locked when active account changes', () => {
    const next = accountReducer(UNLOCKED_A, { type: 'STORE_UPDATED', store: { accounts: ALL, activeId: ACCOUNT_B.pubkey } });
    expect(next.status).toBe('locked');
    if (next.status === 'locked') expect(next.account.pubkey).toBe(ACCOUNT_B.pubkey);
  });
});
