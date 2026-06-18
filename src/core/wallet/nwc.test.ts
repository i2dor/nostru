import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nip04 } from 'nostr-tools';
import { parseNwcUri, NwcClient } from './nwc';

// --- module mocks ---

vi.mock('@noble/hashes/utils.js', () => ({
  hexToBytes: vi.fn(() => new Uint8Array(32)),
}));

vi.mock('nostr-tools', () => ({
  getPublicKey: vi.fn(() => 'clientpubkey'),
  nip04: {
    encrypt: vi.fn(async () => 'ENCRYPTED'),
    decrypt: vi.fn(async () => JSON.stringify({ result_type: 'get_balance', result: { balance: 21_000_000 } })),
  },
}));

const mockStop = vi.fn();
const mockSign = vi.fn().mockResolvedValue(undefined);
const mockPublish = vi.fn();
let capturedEventHandler: ((ev: { content: string }) => void) | null = null;
const mockSubscribe = vi.fn(() => ({
  on: (ev: string, fn: (e: { content: string }) => void) => { if (ev === 'event') capturedEventHandler = fn; },
  stop: mockStop,
}));

vi.mock('@nostr-dev-kit/ndk', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: mockSubscribe,
  })),
  NDKEvent: vi.fn().mockImplementation(() => ({
    id: 'reqid',
    content: '',
    tags: [],
    sign: mockSign,
    publish: mockPublish,
  })),
  NDKPrivateKeySigner: vi.fn(),
}));

const mockNip04Decrypt = vi.mocked(nip04.decrypt);
const mockNip04Encrypt = vi.mocked(nip04.encrypt);

// Fire the subscription event after publish resolves
function setupPublishWithResponse(decryptedJson: object) {
  mockNip04Decrypt.mockResolvedValueOnce(JSON.stringify(decryptedJson));
  mockPublish.mockImplementationOnce(async () => {
    queueMicrotask(() => capturedEventHandler?.({ content: 'ENCRYPTED' }));
  });
}

const VALID_URI = 'nostr+walletconnect://walletpubkey?relay=wss://relay.example.com&secret=aabbccdd&lud16=alice@domain.com';

// -------------------- parseNwcUri --------------------

describe('parseNwcUri', () => {
  it('parses all fields from a valid URI', () => {
    const info = parseNwcUri(VALID_URI);
    expect(info.walletPubkey).toBe('walletpubkey');
    expect(info.relayUrl).toBe('wss://relay.example.com');
    expect(info.secretHex).toBe('aabbccdd');
    expect(info.lud16).toBe('alice@domain.com');
  });

  it('lud16 is undefined when not present', () => {
    const info = parseNwcUri('nostr+walletconnect://wpk?relay=wss://r.com&secret=ss');
    expect(info.lud16).toBeUndefined();
  });

  it('throws on wrong scheme', () => {
    expect(() => parseNwcUri('lightning:abc')).toThrow('Invalid NWC URI');
  });

  it('throws when relay is missing', () => {
    expect(() => parseNwcUri('nostr+walletconnect://wpk?secret=ss')).toThrow('missing relay');
  });

  it('throws when secret is missing', () => {
    expect(() => parseNwcUri('nostr+walletconnect://wpk?relay=wss://r.com')).toThrow('missing secret');
  });
});

// -------------------- NwcClient --------------------

describe('NwcClient', () => {
  let client: NwcClient;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEventHandler = null;
    client = new NwcClient(parseNwcUri(VALID_URI));
  });

  it('getBalance converts msats to sats', async () => {
    setupPublishWithResponse({ result_type: 'get_balance', result: { balance: 21_000_000 } });
    const sats = await client.getBalance();
    expect(sats).toBe(21_000);
  });

  it('payInvoice returns the preimage', async () => {
    setupPublishWithResponse({ result_type: 'pay_invoice', result: { preimage: 'abc123' } });
    const preimage = await client.payInvoice('lnbc1...');
    expect(preimage).toBe('abc123');
  });

  it('throws when NWC returns error response', async () => {
    mockNip04Decrypt.mockResolvedValueOnce(
      JSON.stringify({ result_type: 'pay_invoice', error: { code: 'INSUFFICIENT_BALANCE', message: 'not enough sats' } })
    );
    mockPublish.mockImplementationOnce(async () => {
      queueMicrotask(() => capturedEventHandler?.({ content: 'ENCRYPTED' }));
    });
    await expect(client.payInvoice('lnbc1...')).rejects.toThrow('not enough sats');
  });

  it('encrypts the request to walletPubkey', async () => {
    setupPublishWithResponse({ result_type: 'get_balance', result: { balance: 0 } });
    await client.getBalance();
    expect(mockNip04Encrypt).toHaveBeenCalledWith('aabbccdd', 'walletpubkey', expect.stringContaining('get_balance'));
  });
});
