import { useState, useCallback, useEffect, useMemo } from 'react';
import { IconSend } from '@tabler/icons-react';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNDK } from '../../core/ndk';
import { publishNote } from '../../core/events/publish';
import { buildReplyTags, parseNIP10 } from '../../core/events/nip10';
import { NoteCard } from '../components/NoteCard';
import { useFeed } from '../feed/hooks';

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

function ThreadConnector() {
  return (
    <div className="px-4">
      <div className="ml-[33px] w-0.5 h-3 bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

export function ThreadView({ event }: { event: NDKEvent }) {
  const { ndk } = useNDK();
  const [replyContent, setReplyContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [parentChain, setParentChain] = useState<NDKEvent[]>([]);
  const [chainLoading, setChainLoading] = useState(false);

  const { root, reply: parent } = useMemo(() => parseNIP10(event.tags), [event.tags]);

  const hasAncestors = !!(root?.id || parent?.id);

  useEffect(() => {
    if (!ndk || !hasAncestors) return;
    let cancelled = false;
    setChainLoading(true);

    async function fetchChain() {
      const chain: NDKEvent[] = [];

      if (root?.id && root.id !== event.id) {
        const rootEv = await ndk!.fetchEvent(root.id).catch(() => null);
        if (!cancelled && rootEv) chain.push(rootEv);
      }

      if (parent?.id && parent.id !== root?.id && parent.id !== event.id) {
        const parentEv = await ndk!.fetchEvent(parent.id).catch(() => null);
        if (!cancelled && parentEv) chain.push(parentEv);
      }

      if (!cancelled) {
        setParentChain(chain);
        setChainLoading(false);
      }
    }

    void fetchChain();
    return () => { cancelled = true; };
  }, [ndk, event.id, root, parent, hasAncestors]);

  const { events: replies, eose } = useFeed(
    { kinds: [1], '#e': [event.id], limit: 100 },
    !!ndk,
  );

  const handleReply = useCallback(async () => {
    if (!ndk || !replyContent.trim() || busy) return;
    setError('');
    setBusy(true);
    try {
      await publishNote(ndk, replyContent, buildReplyTags(event));
      setReplyContent('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  }, [ndk, replyContent, busy, event]);

  return (
    <div className="flex-1 overflow-y-auto">
      {hasAncestors && chainLoading && (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      )}

      {parentChain.map((ancestor, i) => (
        <div key={ancestor.id}>
          <NoteCard event={ancestor} />
          {i < parentChain.length - 1 && <ThreadConnector />}
        </div>
      ))}

      {parentChain.length > 0 && <ThreadConnector />}

      <div className="border-l-2 border-accent/30">
        <NoteCard event={event} />
      </div>

      <div className="border-b border-zinc-100 dark:border-zinc-800 p-3 space-y-2 bg-zinc-50 dark:bg-zinc-900/50">
        <textarea
          value={replyContent}
          onChange={e => setReplyContent(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleReply(); }}
          placeholder="Reply..."
          rows={3}
          className="w-full text-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none resize-none placeholder:text-zinc-400 leading-relaxed"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end">
          <button
            onClick={handleReply}
            disabled={busy || !replyContent.trim() || !ndk}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-medium"
          >
            <IconSend size={13} />
            {busy ? 'Posting...' : 'Reply'}
          </button>
        </div>
      </div>

      <div>
        {!eose && replies.length === 0 && <Spinner />}
        {replies.map(r => <NoteCard key={r.id} event={r} />)}
        {eose && replies.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-8">No replies yet.</p>
        )}
      </div>
    </div>
  );
}
