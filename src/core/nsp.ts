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

  // BIP-352 address: bech32m("sp", [version=0x00] + scanPub33 + spendPub33)
  const payload = new Uint8Array([0x00, ...ScanPub.toBytes(true), ...SpendPub.toBytes(true)]);
  return bech32m.encode('sp', bech32m.toWords(payload), 1000);
}
