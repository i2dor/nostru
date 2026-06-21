import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { useProfile } from '../feed/hooks';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { useNav } from '../context/NavContext';
import { relativeTime } from './NoteCard';

function getTag(event: NDKEvent, name: string): string {
  return event.tags.find(t => t[0] === name)?.[1] ?? '';
}

export function ArticleCard({ event }: { event: NDKEvent }) {
  const { push } = useNav();
  const profile = useProfile(event.pubkey);
  const name = profile?.displayName ?? profile?.name ?? truncateNpub(encodePubkey(event.pubkey));

  const title = getTag(event, 'title') || 'Untitled';
  const image = getTag(event, 'image');
  const summary = getTag(event, 'summary') || event.content.slice(0, 200).replace(/[#*`[\]]/g, '');
  const publishedAt = getTag(event, 'published_at');
  const ts = publishedAt ? parseInt(publishedAt, 10) : (event.created_at ?? 0);

  return (
    <article
      className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer space-y-2"
      onClick={() => push({ view: 'article', event })}
    >
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="font-medium text-zinc-600 dark:text-zinc-400 truncate">{name}</span>
        <span>·</span>
        <span className="shrink-0">{relativeTime(ts)}</span>
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-zinc-300 dark:text-zinc-600 font-medium">Article</span>
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-snug line-clamp-2">{title}</h3>
          {summary && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{summary}</p>
          )}
        </div>
        {image && (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="w-16 h-16 rounded-lg object-cover shrink-0"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
    </article>
  );
}
