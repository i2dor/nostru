import { useState, useMemo, useCallback, useEffect } from 'react';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { IconRepeat } from '@tabler/icons-react';
import { useNDK } from '../../core/ndk';
import { NoteCard } from '../components/NoteCard';
import { ArticleCard } from '../components/ArticleCard';
import { Composer } from '../components/Composer';
import { useFeed, useFollows, useGlobalFeed, useBlocks, useMutes, useProfile } from './hooks';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { isSpam } from '../../core/feed/spamFilter';
import { getSpamFilterEnabled } from '../../core/store/spamFilter';

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-center text-zinc-400 text-sm py-12">{text}</p>;
}

function mergeWithOptimistic(relayEvents: NDKEvent[], optimistic: NDKEvent[]): NDKEvent[] {
  const relayIds = new Set(relayEvents.map(e => e.id));
  const fresh = optimistic.filter(e => !relayIds.has(e.id));
  return [...fresh, ...relayEvents];
}

type RawNostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  sig?: string;
};

function RepostCard({ event }: { event: NDKEvent }) {
  const { ndk } = useNDK();
  const reposterProfile = useProfile(event.pubkey);
  const reposterName = reposterProfile?.displayName ?? reposterProfile?.name ?? truncateNpub(encodePubkey(event.pubkey));
  const [originalEvent, setOriginalEvent] = useState<NDKEvent | null>(null);

  useEffect(() => {
    // Try to parse original event from content (NIP-18)
    try {
      const data = JSON.parse(event.content) as RawNostrEvent;
      if (data.id && data.pubkey && typeof data.kind === 'number') {
        const ev = new NDKEvent(ndk ?? undefined, data);
        setOriginalEvent(ev);
        return;
      }
    } catch { /* not JSON */ }

    // Fall back to fetching by e tag
    const eTag = event.tags.find(t => t[0] === 'e');
    if (!eTag?.[1] || !ndk) return;
    let cancelled = false;
    ndk.fetchEvent(eTag[1]).then(ev => {
      if (!cancelled && ev) setOriginalEvent(ev);
    });
    return () => { cancelled = true; };
  }, [event, ndk]);

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-0 text-xs text-zinc-400">
        <IconRepeat size={11} className="text-green-400 shrink-0" />
        <span className="truncate">{reposterName} reposted</span>
      </div>
      {originalEvent
        ? <NoteCard event={originalEvent} />
        : <div className="px-4 py-3 text-xs text-zinc-400">Loading...</div>
      }
    </div>
  );
}

function EventCard({ event, onQuote }: { event: NDKEvent; onQuote?: (url: string, eventId: string) => void }) {
  if (event.kind === 6) return <RepostCard event={event} />;
  if (event.kind === 30023) return <ArticleCard event={event} />;
  return <NoteCard event={event} onQuote={onQuote} />;
}

function FollowingFeed({ pubkey, optimistic, onQuote }: { pubkey: string; optimistic: NDKEvent[]; onQuote?: (url: string, eventId: string) => void }) {
  const follows = useFollows(pubkey);
  const blocks = useBlocks();
  const mutes = useMutes();
  const filter = useMemo(
    () => ({ kinds: [1, 6, 30023] as number[], authors: follows ?? [], limit: 50 }),
    [follows],
  );
  const { events, eose } = useFeed(filter, follows !== null && follows.length > 0);
  const all = useMemo(
    () => mergeWithOptimistic(events, optimistic).filter(ev => !blocks.has(ev.pubkey) && !mutes.has(ev.pubkey)),
    [events, optimistic, blocks, mutes],
  );

  if (follows === null) return <Spinner />;
  if (follows.length === 0 && optimistic.length === 0) {
    return <EmptyState text="You are not following anyone yet." />;
  }
  if (!eose && events.length === 0 && optimistic.length === 0) return <Spinner />;
  if (all.length === 0) return <EmptyState text="No recent notes from people you follow." />;

  return <div>{all.map(ev => <EventCard key={ev.id} event={ev} onQuote={onQuote} />)}</div>;
}

function GlobalFeed({ optimistic, onQuote }: { optimistic: NDKEvent[]; onQuote?: (url: string, eventId: string) => void }) {
  const { ndk } = useNDK();
  const blocks = useBlocks();
  const mutes = useMutes();
  const { events, eose } = useGlobalFeed(ndk);
  const [spamFilter, setSpamFilter] = useState(true);

  useEffect(() => { getSpamFilterEnabled().then(setSpamFilter); }, []);

  const all = useMemo(
    () => mergeWithOptimistic(events, optimistic).filter(ev =>
      !blocks.has(ev.pubkey) && !mutes.has(ev.pubkey) && !(spamFilter && isSpam(ev)),
    ),
    [events, optimistic, blocks, mutes, spamFilter],
  );

  if (!ndk) return <Spinner />;
  if (!eose && all.length === 0) return <Spinner />;
  if (all.length === 0) return <EmptyState text="No events yet." />;

  return <div>{all.map(ev => <EventCard key={ev.id} event={ev} onQuote={onQuote} />)}</div>;
}

type Tab = 'following' | 'global';

export function FeedView({ pubkey }: { pubkey: string }) {
  const [tab, setTab] = useState<Tab>('following');
  const [optimistic, setOptimistic] = useState<NDKEvent[]>([]);
  const [quoteText, setQuoteText] = useState('');
  const [quoteEventId, setQuoteEventId] = useState('');

  const handlePublished = useCallback((event: NDKEvent) => {
    setOptimistic(prev => [event, ...prev]);
  }, []);

  const handleQuote = useCallback((url: string, eventId: string) => {
    setQuoteEventId(eventId);
    setQuoteText(url);
  }, []);

  const handleQuoteConsumed = useCallback(() => {
    setQuoteText('');
    setQuoteEventId('');
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Composer
        onPublished={handlePublished}
        quoteText={quoteText}
        quoteEventId={quoteEventId}
        onQuoteConsumed={handleQuoteConsumed}
      />

      <div className="flex border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        {(['following', 'global'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors border-b-2 ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'following'
          ? <FollowingFeed pubkey={pubkey} optimistic={optimistic} onQuote={handleQuote} />
          : <GlobalFeed optimistic={optimistic} onQuote={handleQuote} />}
      </div>
    </div>
  );
}
