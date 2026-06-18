import { useState, useMemo, useCallback } from 'react';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNDK } from '../../core/ndk';
import { NoteCard } from '../components/NoteCard';
import { Composer } from '../components/Composer';
import { useFeed, useFollows, useGlobalFeed } from './hooks';

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

function FollowingFeed({ pubkey, optimistic }: { pubkey: string; optimistic: NDKEvent[] }) {
  const follows = useFollows(pubkey);
  const filter = useMemo(
    () => ({ kinds: [1] as number[], authors: follows ?? [], limit: 50 }),
    [follows],
  );
  const { events, eose } = useFeed(filter, follows !== null && follows.length > 0);
  const all = useMemo(() => mergeWithOptimistic(events, optimistic), [events, optimistic]);

  if (follows === null) return <Spinner />;
  if (follows.length === 0 && optimistic.length === 0) {
    return <EmptyState text="You are not following anyone yet." />;
  }
  if (!eose && events.length === 0 && optimistic.length === 0) return <Spinner />;
  if (all.length === 0) return <EmptyState text="No recent notes from people you follow." />;

  return <div>{all.map(ev => <NoteCard key={ev.id} event={ev} />)}</div>;
}

function GlobalFeed({ optimistic }: { optimistic: NDKEvent[] }) {
  const { ndk } = useNDK();
  const { events, eose } = useGlobalFeed(ndk);
  const all = useMemo(() => mergeWithOptimistic(events, optimistic), [events, optimistic]);

  if (!ndk) return <Spinner />;
  if (!eose && all.length === 0) return <Spinner />;
  if (all.length === 0) return <EmptyState text="No events yet." />;

  return <div>{all.map(ev => <NoteCard key={ev.id} event={ev} />)}</div>;
}

type Tab = 'following' | 'global';

export function FeedView({ pubkey }: { pubkey: string }) {
  const [tab, setTab] = useState<Tab>('following');
  const [optimistic, setOptimistic] = useState<NDKEvent[]>([]);

  const handlePublished = useCallback((event: NDKEvent) => {
    setOptimistic(prev => [event, ...prev]);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Composer onPublished={handlePublished} />

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
          ? <FollowingFeed pubkey={pubkey} optimistic={optimistic} />
          : <GlobalFeed optimistic={optimistic} />}
      </div>
    </div>
  );
}
