import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lud16ToUrl, buildCallbackUrl, resolveLud16, fetchInvoice } from './lnurl';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => vi.clearAllMocks());

describe('lud16ToUrl', () => {
  it('converts standard lightning address', () => {
    expect(lud16ToUrl('alice@getalby.com')).toBe('https://getalby.com/.well-known/lnurlp/alice');
  });

  it('handles subdomain', () => {
    expect(lud16ToUrl('bob@pay.strike.me')).toBe('https://pay.strike.me/.well-known/lnurlp/bob');
  });

  it('handles @ in the local part by splitting on last @', () => {
    expect(lud16ToUrl('a@b@domain.com')).toBe('https://domain.com/.well-known/lnurlp/a@b');
  });
});

describe('buildCallbackUrl', () => {
  it('appends amount param', () => {
    const url = buildCallbackUrl('https://getalby.com/lnurlp/alice/callback', 21_000);
    expect(url).toContain('amount=21000');
  });

  it('appends nostr param when zap request provided', () => {
    const url = buildCallbackUrl('https://getalby.com/cb', 1000, '{"kind":9734}');
    expect(url).toContain('nostr=');
    expect(url).toContain(encodeURIComponent('{"kind":9734}'));
  });

  it('omits nostr param when not provided', () => {
    const url = buildCallbackUrl('https://getalby.com/cb', 1000);
    expect(url).not.toContain('nostr');
  });
});

describe('resolveLud16', () => {
  it('fetches and parses LNURL-pay params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        callback: 'https://getalby.com/lnurlp/alice/callback',
        minSendable: 1000,
        maxSendable: 100_000_000,
        allowsNostr: true,
        nostrPubkey: 'aabbcc',
      }),
    });
    const params = await resolveLud16('alice@getalby.com');
    expect(params.callback).toBe('https://getalby.com/lnurlp/alice/callback');
    expect(params.allowsNostr).toBe(true);
    expect(params.nostrPubkey).toBe('aabbcc');
    expect(mockFetch).toHaveBeenCalledWith('https://getalby.com/.well-known/lnurlp/alice');
  });

  it('throws when server returns ERROR status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ERROR', reason: 'Not found' }),
    });
    await expect(resolveLud16('nobody@nowhere.com')).rejects.toThrow('Not found');
  });

  it('throws on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(resolveLud16('x@y.com')).rejects.toThrow('404');
  });
});

describe('fetchInvoice', () => {
  it('returns the bolt11 invoice string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pr: 'lnbc210n1...' }),
    });
    const pr = await fetchInvoice('https://cb.example.com', 21_000);
    expect(pr).toBe('lnbc210n1...');
  });

  it('throws when pr is missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(fetchInvoice('https://cb.example.com', 1000)).rejects.toThrow('No invoice');
  });
});
