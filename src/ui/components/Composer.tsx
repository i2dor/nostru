import { useState, useRef, useCallback } from 'react';
import { IconSend, IconX } from '@tabler/icons-react';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNDK } from '../../core/ndk';
import { publishNote } from '../../core/events/publish';

interface ComposerProps {
  onPublished: (event: NDKEvent) => void;
}

export function Composer({ onPublished }: ComposerProps) {
  const { ndk } = useNDK();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleCancel = () => {
    setOpen(false);
    setContent('');
    setError('');
  };

  const handlePost = useCallback(async () => {
    if (!ndk || !content.trim() || busy) return;
    setError('');
    setBusy(true);
    try {
      const event = await publishNote(ndk, content);
      onPublished(event);
      setContent('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  }, [ndk, content, busy, onPublished]);

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        disabled={!ndk}
        className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors disabled:cursor-not-allowed"
      >
        What's on your mind?
      </button>
    );
  }

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 space-y-2">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') handleCancel();
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handlePost();
        }}
        placeholder="What's on your mind?"
        rows={4}
        className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-zinc-400 leading-relaxed"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${content.length > 480 ? 'text-red-400' : 'text-zinc-400'}`}>
          {content.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors"
          >
            <IconX size={13} /> Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={busy || !content.trim() || !ndk}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-medium"
          >
            <IconSend size={13} />
            {busy ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
