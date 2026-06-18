import { describe, it, expect } from 'vitest';
import { generateKeypair, derivePubkey, bytesToHex, hexToBytes } from './crypto';

describe('generateKeypair', () => {
  it('produces a 32-byte private key and a 64-char hex pubkey', () => {
    const { privkey, pubkey } = generateKeypair();
    expect(privkey).toBeInstanceOf(Uint8Array);
    expect(privkey.length).toBe(32);
    expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique keypairs each call', () => {
    const a = generateKeypair();
    const b = generateKeypair();
    expect(bytesToHex(a.privkey)).not.toBe(bytesToHex(b.privkey));
  });
});

describe('derivePubkey', () => {
  it('derives the same pubkey as the keypair that generated the privkey', () => {
    const { privkey, pubkey } = generateKeypair();
    expect(derivePubkey(privkey)).toBe(pubkey);
  });
});

describe('bytesToHex / hexToBytes', () => {
  it('round-trips a 32-byte value', () => {
    const { privkey } = generateKeypair();
    expect(hexToBytes(bytesToHex(privkey))).toEqual(privkey);
  });

  it('hexToBytes throws on non-64-char input', () => {
    expect(() => hexToBytes('deadbeef')).toThrow();
  });
});
