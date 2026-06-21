import { IconBell, IconHeart, IconRepeat, IconBolt, IconAt } from '@tabler/icons-react';
import { NDKSubscriptionCacheUsage, type NDKEvent } from '@nostr-dev-kit/ndk';
import { useAccount } from '../context/AccountContext';
import { useFeed, useProfile, useBlocks } from '../feed/hooks';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { useNav } from '../context/NavContext';

function notificationIcon(kind: number) {
  if (kind === 7) return <IconHeart size={14} className="text-red-400" />;
  if (kind === 6) return <IconRepeat size={14} className="text-green-400" />;
  if (kind === 9735) return <IconBolt size={14} className="text-zap" />;
  return <IconAt size={14} className="text-accent" />;
}

function notificationLabel(kind: number): string {
  if (kind === 7) return 'reacted';
  if (kind === 6) return 'reposted';
  if (kind === 9735) return 'zapped';
  return 'mentioned you';
}

function NotificationRow({ event }: { event: NDKEvent }) {
  const { push } = useNav();
  const profile = useProfile(event.pubkey);
  const display = profile?.displayName ?? profile?.name ?? truncateNpub(encodePubkey(event.pubkey));
  const kind = event.kind ?? 1;

  const handleClick = () => {
    if (kind === 1) {
      push({ view: 'thread', event });
    } else {
      const targetId = event.tags.find(t => t[0] === 'e')?.[1];
      if (targetId) push({ view: 'event-ref', eventId: targetId });
      else push({ view: 'profile', pubkey: event.pubkey });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors border-b border-zinc-100 dark:border-zinc-800 text-left"
    >
      <div className="mt-0.5 shrink-0">{notificationIcon(kind)}</div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm">
          <span className="font-medium">{display}</span>{' '}
          <span className="text-zinc-500">{notificationLabel(kind)}</span>
        </p>
        {event.content && (
          <p className="text-xs text-zinc-400 truncate">{event.content}</p>
        )}
      </div>
    </button>
  );
}

export function NotificationsScreen() {
  const { session } = useAccount();
  const myPubkey = session.status === 'unlocked' || session.status === 'locked'
    ? session.account.pubkey
    : '';
  const blocks = useBlocks();
  const since = Math.floor(Date.now() / 1000) - 86400 * 30; // last 30 days
  const { events: raw, eose } = useFeed(
    { kinds: [1, 6, 7, 9735] as number[], '#p': [myPubkey], since, limit: 100 },
    !!myPubkey,
    { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY },
  );
  const events = raw.filter(ev => !blocks.has(ev.pubkey));

  if (!myPubkey) return null;

  if (!eose && events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400">
        <IconBell size={32} strokeWidth={1.5} />
        <p className="text-sm">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {events.map(ev => <NotificationRow key={ev.id} event={ev} />)}
    </div>
  );
}
