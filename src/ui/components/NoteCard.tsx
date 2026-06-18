import { useState, useCallback } from 'react';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { IconArrowForwardUp, IconRepeat, IconHeart, IconBolt } from '@tabler/icons-react';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { useProfile } from '../feed/hooks';
import { useNDK } from '../../core/ndk';
import { publishLike, publishRepost } from '../../core/events/reactions';
import { useNav } from '../context/NavContext';

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Avatar({ pubkey, name, onClick }: { pubkey: string; name?: string; onClick?: () => void }) {
  const initials = (name ?? pubkey).slice(0, 2).toUpperCase();
  const hue = parseInt(pubkey.slice(0, 4), 16) % 360;
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0 focus:outline-none"
      style={{ backgroundColor: `hsl(${hue} 60% 45%)` }}
      aria-label="View profile"
    >
      {initials}
    </button>
  );
}

function AuthorLine({ pubkey, onClick }: { pubkey: string; onClick?: () => void }) {
  const profile = useProfile(pubkey);
  const display = profile?.displayName ?? profile?.name ?? truncateNpub(encodePubkey(pubkey));
  return (
    <button onClick={onClick} className="text-sm font-medium truncate hover:underline text-left focus:outline-none">
      {display}
    </button>
  );
}

export function NoteCard({ event }: { event: NDKEvent }) {
  const ts = event.created_at ?? 0;
  const { ndk } = useNDK();
  const { push } = useNav();
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reposted, setReposted] = useState(false);

  const goProfile = useCallback(() => {
    push({ view: 'profile', pubkey: event.pubkey });
  }, [push, event.pubkey]);

  const goThread = useCallback(() => {
    push({ view: 'thread', event });
  }, [push, event]);

  const handleLike = useCallback(async () => {
    if (!ndk || liked || liking) return;
    setLiking(true);
    setLiked(true);
    try {
      await publishLike(ndk, event);
    } catch {
      setLiked(false);
    } finally {
      setLiking(false);
    }
  }, [ndk, liked, liking, event]);

  const handleRepost = useCallback(async () => {
    if (!ndk || reposted) return;
    setReposted(true);
    try {
      await publishRepost(ndk, event);
    } catch {
      setReposted(false);
    }
  }, [ndk, reposted, event]);

  return (
    <article className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
      <div className="flex gap-3">
        <Avatar pubkey={event.pubkey} onClick={goProfile} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <AuthorLine pubkey={event.pubkey} onClick={goProfile} />
            <span className="text-xs text-zinc-400 shrink-0">{relativeTime(ts)}</span>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
            {event.content}
          </p>
          <div className="flex gap-5 pt-1">
            <button
              onClick={goThread}
              className="flex items-center gap-1 text-zinc-400 hover:text-accent transition-colors"
              aria-label="Reply"
            >
              <IconArrowForwardUp size={15} />
            </button>
            <button
              onClick={handleRepost}
              className={`flex items-center gap-1 transition-colors ${reposted ? 'text-green-500' : 'text-zinc-400 hover:text-green-500'}`}
              aria-label="Repost"
            >
              <IconRepeat size={15} />
            </button>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 transition-colors ${liked ? 'text-red-500' : 'text-zinc-400 hover:text-red-500'}`}
              aria-label="Like"
            >
              <IconHeart size={15} fill={liked ? 'currentColor' : 'none'} />
            </button>
            <button className="flex items-center gap-1 text-zinc-400 hover:text-zap transition-colors" aria-label="Zap">
              <IconBolt size={15} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
