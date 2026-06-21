import { useMemo } from 'react';
import { marked } from 'marked';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { useProfile } from '../feed/hooks';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { relativeTime } from '../components/NoteCard';

function getTag(event: NDKEvent, name: string): string {
  return event.tags.find(t => t[0] === name)?.[1] ?? '';
}

marked.setOptions({ breaks: true });

export function ArticleView({ event }: { event: NDKEvent }) {
  const profile = useProfile(event.pubkey);
  const name = profile?.displayName ?? profile?.name ?? truncateNpub(encodePubkey(event.pubkey));
  const picture = profile?.picture;

  const title = getTag(event, 'title') || 'Untitled';
  const image = getTag(event, 'image');
  const publishedAt = getTag(event, 'published_at');
  const ts = publishedAt ? parseInt(publishedAt, 10) : (event.created_at ?? 0);

  const html = useMemo(() => {
    const result = marked.parse(event.content ?? '');
    return typeof result === 'string' ? result : '';
  }, [event.content]);

  return (
    <div className="flex-1 overflow-y-auto">
      {image && (
        <img
          src={image}
          alt=""
          className="w-full max-h-48 object-cover"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      <div className="px-4 py-4 space-y-3 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 leading-tight">{title}</h1>

        <div className="flex items-center gap-2">
          {picture && (
            <img src={picture} alt="" className="w-6 h-6 rounded-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{name}</span>
          <span className="text-xs text-zinc-300 dark:text-zinc-600">·</span>
          <span className="text-xs text-zinc-400">{relativeTime(ts)}</span>
        </div>
      </div>

      <div
        className="px-4 py-4 prose prose-sm prose-zinc dark:prose-invert max-w-none
          prose-headings:font-semibold prose-headings:text-zinc-800 dark:prose-headings:text-zinc-100
          prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-p:leading-relaxed
          prose-a:text-accent prose-a:no-underline hover:prose-a:underline
          prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:rounded prose-code:px-1 prose-code:text-xs
          prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-800 prose-pre:rounded-lg
          prose-blockquote:border-l-accent prose-blockquote:text-zinc-500
          prose-img:rounded-lg prose-img:max-h-96 prose-img:object-contain"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
