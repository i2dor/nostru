import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSecretKey, getPublicKey, verifyEvent, nip04, nip44, type NostrEvent } from 'nostr-tools';
import { bytesToHex } from '../keys/crypto';
import { executeNip07 } from './execute';

const mockGet = vi.fn().mockResolvedValue({ relays: {} });
vi.stubGlobal('chrome', { storage: { local: { get: mockGet } } });

const privkey = generateSecretKey();
const privkeyHex = bytesToHex(privkey);
const pubkey = getPublicKey(privkey);

beforeEach(() => vi.clearAllMocks());

describe('executeNip07', () => {
  it('getPublicKey returns hex pubkey', async () => {
    const result = await executeNip07('getPublicKey', undefined, privkeyHex);
    expect(result).toBe(pubkey);
  });

  it('signEvent produces a valid signed event', async () => {
    const template = { kind: 1, content: 'hello', tags: [], created_at: 1700000000 };
    const signed = await executeNip07('signEvent', { event: template }, privkeyHex) as NostrEvent;
    expect(verifyEvent(signed)).toBe(true);
    expect(signed.pubkey).toBe(pubkey);
    expect(signed.content).toBe('hello');
  });

  it('signEvent fills created_at when missing', async () => {
    const template = { kind: 1, content: '', tags: [] };
    const signed = await executeNip07('signEvent', { event: template }, privkeyHex) as { created_at: number };
    expect(signed.created_at).toBeGreaterThan(0);
  });

  it('nip04 encrypt/decrypt round-trips', async () => {
    const recipientKey = generateSecretKey();
    const recipientPubkey = getPublicKey(recipientKey);
    const plaintext = 'secret message';

    const ciphertext = await executeNip07('nip04.encrypt', { pubkey: recipientPubkey, plaintext }, privkeyHex) as string;
    expect(typeof ciphertext).toBe('string');

    const decrypted = await nip04.decrypt(recipientKey, pubkey, ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('nip44 encrypt/decrypt round-trips', async () => {
    const recipientKey = generateSecretKey();
    const recipientPubkey = getPublicKey(recipientKey);
    const plaintext = 'nip44 secret';

    const ciphertext = await executeNip07('nip44.encrypt', { pubkey: recipientPubkey, plaintext }, privkeyHex) as string;
    expect(typeof ciphertext).toBe('string');

    const decrypted = nip44.decrypt(ciphertext, nip44.getConversationKey(recipientKey, pubkey));
    expect(decrypted).toBe(plaintext);
  });

  it('getRelays returns stored relay map', async () => {
    const relays = { 'wss://relay.test': { read: true, write: true } };
    mockGet.mockResolvedValueOnce({ relays });
    const result = await executeNip07('getRelays', undefined, privkeyHex);
    expect(result).toEqual(relays);
  });

  it('throws on unknown method', async () => {
    await expect(
      executeNip07('unknown' as 'getPublicKey', undefined, privkeyHex),
    ).rejects.toThrow('Unknown NIP-07 method');
  });
});
