import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export function addToFollows(current: string[], target: string): string[] {
  return current.includes(target) ? current : [...current, target];
}

export function removeFromFollows(current: string[], target: string): string[] {
  return current.filter(pk => pk !== target);
}

export async function publishFollowList(ndk: NDK, pubkeys: string[]): Promise<NDKEvent> {
  const event = new NDKEvent(ndk, {
    kind: 3,
    content: '',
    tags: pubkeys.map(pk => ['p', pk]),
  });
  await event.sign();
  await event.publish();
  return event;
}

export async function follow(ndk: NDK, targetPubkey: string, currentFollows: string[]): Promise<void> {
  const next = addToFollows(currentFollows, targetPubkey);
  if (next === currentFollows) return;
  await publishFollowList(ndk, next);
}

export async function unfollow(ndk: NDK, targetPubkey: string, currentFollows: string[]): Promise<void> {
  await publishFollowList(ndk, removeFromFollows(currentFollows, targetPubkey));
}
