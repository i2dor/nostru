import { describe, it, expect } from 'vitest';
import { deriveNspAddress } from './nsp';

// x-only pubkeys (32-byte hex, BIP-340 / Nostr style)
const PUBKEY_A = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const PUBKEY_B = 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';

describe('deriveNspAddress', () => {
  it('produces a bech32m sp1 address', () => {
    const addr = deriveNspAddress(PUBKEY_A);
    expect(addr).toMatch(/^sp1/);
  });

  it('is deterministic', () => {
    expect(deriveNspAddress(PUBKEY_A)).toBe(deriveNspAddress(PUBKEY_A));
  });

  it('differs per pubkey', () => {
    expect(deriveNspAddress(PUBKEY_A)).not.toBe(deriveNspAddress(PUBKEY_B));
  });
});
