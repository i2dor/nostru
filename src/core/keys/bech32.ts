import { npubEncode, nsecEncode, decode } from 'nostr-tools/nip19';
import { hexToBytes } from './crypto';

export function encodePubkey(pubkeyHex: string): string {
  return npubEncode(pubkeyHex);
}

export function encodePrivkey(privkeyBytes: Uint8Array): string {
  return nsecEncode(privkeyBytes);
}

export function parsePrivkey(input: string): Uint8Array {
  const trimmed = input.trim();
  if (trimmed.startsWith('nsec1')) {
    const decoded = decode(trimmed);
    if (decoded.type !== 'nsec') throw new Error('invalid nsec');
    return decoded.data;
  }
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return hexToBytes(trimmed);
  }
  throw new Error('unrecognised key format: expected nsec1... or 64-char hex');
}

export function truncateNpub(npub: string, chars = 8): string {
  const prefix = npub.slice(0, 5 + chars);
  const suffix = npub.slice(-chars);
  return `${prefix}...${suffix}`;
}
