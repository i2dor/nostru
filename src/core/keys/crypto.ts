import { generateSecretKey, getPublicKey } from 'nostr-tools';

export function generateKeypair(): { privkey: Uint8Array; pubkey: string } {
  const privkey = generateSecretKey();
  return { privkey, pubkey: getPublicKey(privkey) };
}

export function derivePubkey(privkey: Uint8Array): string {
  return getPublicKey(privkey);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g);
  if (!pairs || pairs.length !== 32) throw new Error('invalid hex key: expected 64 chars');
  return new Uint8Array(pairs.map(b => parseInt(b, 16)));
}
