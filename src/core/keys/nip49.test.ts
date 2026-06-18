import { describe, it, expect } from 'vitest';
import { encryptKey, decryptKey } from './nip49';
import { generateKeypair, bytesToHex } from './crypto';

describe('NIP-49 encrypt / decrypt', () => {
  it('round-trips a private key', () => {
    const { privkey } = generateKeypair();
    const password = 'hunter2';
    const ncryptsec = encryptKey(privkey, password, 2);
    expect(ncryptsec).toMatch(/^ncryptsec1/);
    const recovered = decryptKey(ncryptsec, password);
    expect(bytesToHex(recovered)).toBe(bytesToHex(privkey));
  });

  it('decryptKey throws on wrong password', () => {
    const { privkey } = generateKeypair();
    const ncryptsec = encryptKey(privkey, 'correct', 2);
    expect(() => decryptKey(ncryptsec, 'wrong')).toThrow();
  });
});
