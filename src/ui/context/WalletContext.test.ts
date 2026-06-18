// WalletContext is React glue that wires NwcClient + storage into React state.
// Core behaviors are covered in:
//   src/core/wallet/nwc.test.ts     (NwcClient.getBalance, payInvoice, error handling)
//   src/core/wallet/lnurl.test.ts   (LNURL resolution + invoice fetch)
//   src/core/wallet/zap.test.ts     (ZapRequest builder)
// This file verifies the exported API surface so regressions in exports surface immediately.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/wallet/storage', () => ({
  getNwcUri: vi.fn(async () => null),
  setNwcUri: vi.fn(async () => {}),
  clearNwcUri: vi.fn(async () => {}),
}));

vi.mock('../../core/wallet/nwc', () => ({
  parseNwcUri: vi.fn(() => ({ walletPubkey: 'pk', relayUrl: 'wss://r', secretHex: 'aa' })),
  NwcClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(async () => {}),
    getBalance: vi.fn(async () => 0),
    disconnect: vi.fn(),
  })),
}));

describe('WalletContext module API', () => {
  it('exports WalletProvider as a function', async () => {
    const { WalletProvider } = await import('./WalletContext');
    expect(typeof WalletProvider).toBe('function');
  });

  it('exports useWallet as a function', async () => {
    const { useWallet } = await import('./WalletContext');
    expect(typeof useWallet).toBe('function');
  });
});
