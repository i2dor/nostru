import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export async function publishLike(ndk: NDK, targetEvent: NDKEvent): Promise<NDKEvent> {
  const reaction = new NDKEvent(ndk, {
    kind: 7,
    content: '+',
    tags: [
      ['e', targetEvent.id],
      ['p', targetEvent.pubkey],
    ],
  });
  await reaction.sign();
  await reaction.publish();
  return reaction;
}

export async function publishRepost(ndk: NDK, targetEvent: NDKEvent): Promise<NDKEvent> {
  const repost = new NDKEvent(ndk, {
    kind: 6,
    content: JSON.stringify(targetEvent.rawEvent()),
    tags: [
      ['e', targetEvent.id, '', 'mention'],
      ['p', targetEvent.pubkey],
    ],
  });
  await repost.sign();
  await repost.publish();
  return repost;
}
