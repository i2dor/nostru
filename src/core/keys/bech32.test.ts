import { describe, it, expect } from 'vitest';
import { encodePubkey, encodePrivkey, parsePrivkey, truncateNpub } from './bech32';
import { generateKeypair, bytesToHex } from './crypto';

describe('encodePubkey', () => {
  it('produces an npub1 string', () => {
    const { pubkey } = generateKeypair();
    expect(encodePubkey(pubkey)).toMatch(/^npub1/);
  });
});

describe('encodePrivkey / parsePrivkey round-trip', () => {
  it('round-trips via nsec', () => {
    const { privkey } = generateKeypair();
    const nsec = encodePrivkey(privkey);
    expect(nsec).toMatch(/^nsec1/);
    expect(bytesToHex(parsePrivkey(nsec))).toBe(bytesToHex(privkey));
  });

  it('round-trips via hex', () => {
    const { privkey } = generateKeypair();
    const hex = bytesToHex(privkey);
    expect(bytesToHex(parsePrivkey(hex))).toBe(hex);
  });

  it('throws on unrecognised input', () => {
    expect(() => parsePrivkey('notakey')).toThrow();
  });
});

describe('truncateNpub', () => {
  it('shortens long npubs to the expected format', () => {
    const { pubkey } = generateKeypair();
    const npub = encodePubkey(pubkey);
    const truncated = truncateNpub(npub);
    expect(truncated).toContain('...');
    expect(truncated.length).toBeLessThan(npub.length);
  });
});
