// WalletScreen is a React view; behaviour tested through WalletContext + NwcClient unit tests.
// This file verifies the module export so renames surface immediately.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(() => ({ nwcUri: null, balance: null, isConnected: false, connect: vi.fn(), disconnect: vi.fn() })),
}));

describe('WalletScreen module API', () => {
  it('exports WalletScreen as a function', async () => {
    const { WalletScreen } = await import('./WalletScreen');
    expect(typeof WalletScreen).toBe('function');
  });
});
