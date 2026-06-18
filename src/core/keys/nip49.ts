import { encrypt, decrypt } from 'nostr-tools/nip49';

export function encryptKey(privkey: Uint8Array, password: string, logn = 18): string {
  return encrypt(privkey, password, logn);
}

export function decryptKey(ncryptsec: string, password: string): Uint8Array {
  return decrypt(ncryptsec, password);
}

export function isNcryptsec(value: string): boolean {
  return value.trim().startsWith('ncryptsec1');
}
