import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes } from '@noble/hashes/utils.js';
import { bech32m } from '@scure/base';

function taggedHash(tag: string, data: Uint8Array): Uint8Array {
  const tagBytes = new TextEncoder().encode(tag);
  const tagHash = sha256(tagBytes);
  return sha256(concatBytes(tagHash, tagHash, data));
}

/**
 * Derives a BIP-352 Silent Payment address from a Nostr x-only pubkey (hex).
 * Anyone who knows the npub can derive this address (NSP = Nostr Silent Payments).
 * Only the nsec holder can detect incoming payments - scan key is root-equivalent.
 */
export function deriveNspAddress(pubkeyHex: string): string {
  const n = secp256k1.Point.Fn.ORDER;
  const G = secp256k1.Point.BASE;

  // Nostr pubkeys are x-only (schnorr); always even-y (02 prefix per BIP-340)
  const P = secp256k1.Point.fromHex('02' + pubkeyHex);
  const Pbytes = P.toBytes(true); // 33-byte compressed

  const t_scan = BigInt('0x' + bytesToHex(taggedHash('nostr-sp/scan', Pbytes))) % n;
  const t_spend = BigInt('0x' + bytesToHex(taggedHash('nostr-sp/spend', Pbytes))) % n;

  const ScanPub = P.add(G.multiply(t_scan));
  const SpendPub = P.add(G.multiply(t_spend));

  // BIP-352: version byte is a single 5-bit word (value 0), NOT converted with toWords
  const payload = concatBytes(ScanPub.toBytes(true), SpendPub.toBytes(true)); // 66 bytes
  return bech32m.encode('sp', [0, ...bech32m.toWords(payload)], 1000);
}

// These are used only by background.ts when talking to the native host.
// They are never stored, logged, or displayed - only passed in-memory.

function derivePrivOffset(privkeyHex: string, tag: string): bigint {
  const n = secp256k1.Point.Fn.ORDER;
  const G = secp256k1.Point.BASE;
  const d = BigInt('0x' + privkeyHex);
  const P = G.multiply(d);
  // Nostr pubkeys are x-only; BIP-340 lift_x always picks even y.
  // Normalize d so d_norm*G has even y, matching the '02' prefix used in
  // deriveNspAddress. Without this, half of all Nostr keys (odd-y) compute
  // the wrong t and b_scan, making the scanner search the wrong address.
  const d_norm = P.y % 2n === 0n ? d : n - d;
  const Pbytes = concatBytes(new Uint8Array([0x02]), P.toBytes(true).slice(1));
  const t = BigInt('0x' + bytesToHex(taggedHash(tag, Pbytes))) % n;
  return (d_norm + t) % n;
}

export function deriveScanPriv(privkeyHex: string): string {
  return derivePrivOffset(privkeyHex, 'nostr-sp/scan').toString(16).padStart(64, '0');
}

export function deriveSpendPriv(privkeyHex: string): string {
  return derivePrivOffset(privkeyHex, 'nostr-sp/spend').toString(16).padStart(64, '0');
}

export function deriveSpendPub(pubkeyHex: string): string {
  const n = secp256k1.Point.Fn.ORDER;
  const G = secp256k1.Point.BASE;
  const P = secp256k1.Point.fromHex('02' + pubkeyHex);
  const t_spend = BigInt('0x' + bytesToHex(taggedHash('nostr-sp/spend', P.toBytes(true)))) % n;
  return bytesToHex(P.add(G.multiply(t_spend)).toBytes(true));
}
