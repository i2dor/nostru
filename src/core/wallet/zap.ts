import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export interface ZapRequestParams {
  recipientPubkey: string;
  lnurl: string;
  amountMsats: number;
  relayUrls: string[];
  comment?: string;
  noteId?: string;
}

export async function buildZapRequest(ndk: NDK, params: ZapRequestParams): Promise<string> {
  const { recipientPubkey, lnurl, amountMsats, relayUrls, comment = '', noteId } = params;

  const tags: string[][] = [
    ['relays', ...relayUrls],
    ['amount', String(amountMsats)],
    ['lnurl', lnurl],
    ['p', recipientPubkey],
  ];
  if (noteId) tags.push(['e', noteId]);

  const event = new NDKEvent(ndk, { kind: 9734, content: comment, tags });
  await event.sign();
  return JSON.stringify(event.rawEvent());
}
