import { useState, useRef, useCallback, useEffect } from 'react';
import { IconSend, IconX } from '@tabler/icons-react';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNDK } from '../../core/ndk';
import { publishNote } from '../../core/events/publish';
import { getDraft, saveDraft, clearDraft } from '../../core/store/draft';

interface ComposerProps {
  onPublished: (event: NDKEvent) => void;
}

export function Composer({ onPublished }: ComposerProps) {
  const { ndk } = useNDK();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getDraft().then(d => { if (d) setHasDraft(true); });
  }, []);

  const scheduleAutoSave = useCallback((text: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft(text).then(() => setHasDraft(!!text));
    }, 500);
  }, []);

  const handleOpen = useCallback(async () => {
    const draft = await getDraft();
    setContent(draft);
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleCancel = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveDraft(content);
    setHasDraft(!!content);
    setOpen(false);
    setError('');
  }, [content]);

  const handleDiscard = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await clearDraft();
    setContent('');
    setHasDraft(false);
    setOpen(false);
    setError('');
  }, []);

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    scheduleAutoSave(text);
  }, [scheduleAutoSave]);

  const handlePost = useCallback(async () => {
    if (!ndk || !content.trim() || busy) return;
    setError('');
    setBusy(true);
    try {
      const event = await publishNote(ndk, content);
      onPublished(event);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await clearDraft();
      setContent('');
      setHasDraft(false);
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
        onClick={() => void handleOpen()}
        disabled={!ndk}
        className="w-full text-left px-4 py-2.5 text-sm border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors disabled:cursor-not-allowed flex items-center gap-2"
      >
        <span className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-1">
          What&apos;s on your mind?
        </span>
        {hasDraft && (
          <span className="text-[10px] text-accent font-medium shrink-0">Draft saved</span>
        )}
      </button>
    );
  }

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 space-y-2">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => handleContentChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') handleCancel();
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handlePost();
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
          {hasDraft && (
            <button
              onClick={() => void handleDiscard()}
              className="text-xs text-zinc-400 hover:text-red-500 transition-colors px-1"
            >
              Discard draft
            </button>
          )}
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors"
          >
            <IconX size={13} /> Cancel
          </button>
          <button
            onClick={() => void handlePost()}
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
