import NDK, { NDKEvent, NDKFilter, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip04, getPublicKey } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils.js';

export interface NwcInfo {
  walletPubkey: string;
  relayUrl: string;
  secretHex: string;
  lud16?: string;
}

export interface NwcBalance {
  balance: number; // sats
}

export interface NwcPayResult {
  preimage: string;
}

interface NwcResponse {
  result_type: string;
  error?: { code: string; message: string };
  result?: Record<string, unknown>;
}

export function parseNwcUri(uri: string): NwcInfo {
  if (!uri.startsWith('nostr+walletconnect://')) {
    throw new Error('Invalid NWC URI: must start with nostr+walletconnect://');
  }
  // nostr+walletconnect://<pubkey>?relay=<relay>&secret=<secret>[&lud16=<lud16>]
  const withoutScheme = uri.slice('nostr+walletconnect://'.length);
  const qIdx = withoutScheme.indexOf('?');
  const walletPubkey = qIdx === -1 ? withoutScheme : withoutScheme.slice(0, qIdx);
  const params = new URLSearchParams(qIdx === -1 ? '' : withoutScheme.slice(qIdx + 1));

  const relayUrl = params.get('relay');
  const secretHex = params.get('secret');
  if (!relayUrl) throw new Error('Invalid NWC URI: missing relay');
  if (!secretHex) throw new Error('Invalid NWC URI: missing secret');

  return { walletPubkey, relayUrl, secretHex, lud16: params.get('lud16') ?? undefined };
}

export class NwcClient {
  private ndk: NDK;
  private info: NwcInfo;
  private clientPubkey: string;

  constructor(info: NwcInfo) {
    this.info = info;
    this.ndk = new NDK({
      explicitRelayUrls: [info.relayUrl],
      signer: new NDKPrivateKeySigner(info.secretHex),
    });
    this.clientPubkey = getPublicKey(hexToBytes(info.secretHex));
  }

  async connect(): Promise<void> {
    await this.ndk.connect(3000);
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const payload = JSON.stringify({ method, params });
    const encrypted = await nip04.encrypt(this.info.secretHex, this.info.walletPubkey, payload);

    const reqEvent = new NDKEvent(this.ndk, {
      kind: 23194,
      content: encrypted,
      tags: [['p', this.info.walletPubkey]],
    });
    await reqEvent.sign();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        sub.stop();
        reject(new Error('NWC request timed out'));
      }, 30_000);

      const filter: NDKFilter = {
        kinds: [23195 as number],
        authors: [this.info.walletPubkey],
        '#p': [this.clientPubkey],
        '#e': [reqEvent.id ?? ''],
        since: Math.floor(Date.now() / 1000) - 5,
      };

      const sub = this.ndk.subscribe(filter, { closeOnEose: false });

      sub.on('event', async (ev: NDKEvent) => {
        try {
          const decrypted = await nip04.decrypt(this.info.secretHex, this.info.walletPubkey, ev.content);
          const resp = JSON.parse(decrypted) as NwcResponse;
          clearTimeout(timeout);
          sub.stop();
          if (resp.error) {
            reject(new Error(`NWC error ${resp.error.code}: ${resp.error.message}`));
          } else {
            resolve(resp.result ?? {});
          }
        } catch (err) {
          clearTimeout(timeout);
          sub.stop();
          reject(err);
        }
      });

      // Publish after subscribing to avoid missing the response
      reqEvent.publish().catch((err: unknown) => {
        clearTimeout(timeout);
        sub.stop();
        reject(err);
      });
    });
  }

  async getBalance(): Promise<number> {
    const result = await this.sendRequest('get_balance', {});
    const balanceMsats = result['balance'] as number;
    return Math.floor(balanceMsats / 1000);
  }

  async payInvoice(invoice: string): Promise<string> {
    const result = await this.sendRequest('pay_invoice', { invoice });
    const preimage = result['preimage'] as string;
    if (!preimage) throw new Error('No preimage in pay_invoice response');
    return preimage;
  }

  disconnect(): void {
    // NDK doesn't expose a public disconnect; relays will timeout naturally
  }
}
