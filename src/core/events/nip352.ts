import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';

export async function publishNip352Address(
  ndk: NDK,
  sp1Address: string,
  network: 'mainnet' | 'signet' | 'testnet' = 'mainnet',
  paymentPubkeyHex?: string,
): Promise<void> {
  const tags: string[][] = [['d', network], ['sp', sp1Address]];
  if (paymentPubkeyHex) tags.push(['payment_pubkey', paymentPubkeyHex]);
  const event = new NDKEvent(ndk, { kind: 30352 as NDKKind, content: '', tags });
  await event.sign();
  await event.publish();
}

export async function fetchNip352Address(
  ndk: NDK,
  pubkeyHex: string,
  network: 'mainnet' | 'signet' | 'testnet' = 'mainnet',
): Promise<string | null> {
  const events = await ndk.fetchEvents({
    kinds: [30352 as NDKKind],
    authors: [pubkeyHex],
    '#d': [network],
    limit: 5,
  });

  let latest: NDKEvent | null = null;
  for (const ev of events) {
    if (!latest || (ev.created_at ?? 0) > (latest.created_at ?? 0)) latest = ev;
  }

  if (!latest) return null;
  return latest.tags.find(t => t[0] === 'sp')?.[1] ?? null;
}
