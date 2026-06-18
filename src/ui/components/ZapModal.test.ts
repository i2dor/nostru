// ZapModal is a React view component; its zap flow logic is covered by:
//   src/core/wallet/lnurl.test.ts  (resolveLud16, fetchInvoice)
//   src/core/wallet/zap.test.ts    (buildZapRequest kind-9734 output)
//   src/core/wallet/nwc.test.ts    (NwcClient.payInvoice)
// This file verifies the module export exists so any renaming/removal surfaces fast.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/ndk', () => ({ useNDK: vi.fn(() => ({ ndk: null })) }));
vi.mock('../feed/hooks', () => ({ useProfile: vi.fn(() => null) }));
vi.mock('../../core/keys', () => ({ encodePubkey: vi.fn(() => 'aa'), truncateNpub: vi.fn(s => s) }));
vi.mock('../context/WalletContext', () => ({ useWallet: vi.fn(() => ({ isConnected: false, payInvoice: vi.fn() })) }));
vi.mock('../../core/wallet/lnurl', () => ({ resolveLud16: vi.fn(), fetchInvoice: vi.fn() }));
vi.mock('../../core/wallet/zap', () => ({ buildZapRequest: vi.fn() }));
vi.mock('../../core/ndk/config', () => ({ DEFAULT_RELAYS: [] }));

describe('ZapModal module API', () => {
  it('exports ZapModal as a function', async () => {
    const { ZapModal } = await import('./ZapModal');
    expect(typeof ZapModal).toBe('function');
  });
});
