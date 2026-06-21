import { useState, useCallback, useEffect } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import {
  IconArrowForwardUp, IconRepeat, IconHeart, IconBolt,
  IconRosetteDiscountCheckFilled, IconBookmark, IconBookmarkFilled,
  IconDots, IconPin, IconAlertTriangle, IconTrash, IconBlockquote,
  IconX, IconDownload, IconArrowUpRight,
} from '@tabler/icons-react';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { useProfile, useNip05, useNoteStats, useBookmarks, useMutes, usePins } from '../feed/hooks';
import { useNDK } from '../../core/ndk';
import { useAccount } from '../context/AccountContext';
import { publishLike, publishRepost } from '../../core/events/reactions';
import { publishDeletion } from '../../core/events/publish';
import { publishBookmarkList, publishMuteList, publishPinList } from '../../core/events/lists';
import { addBookmark, removeBookmark, getBookmarks } from '../../core/store/bookmarks';
import { addMute, removeMute, getMutes } from '../../core/store/mutes';
import { addPin, removePin, getPins } from '../../core/store/pins';
import { useNav } from '../context/NavContext';
import { ZapModal } from './ZapModal';

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?[^)\s]*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|avi)(\?[^)\s]*)?$/i;
// Nostr media hosts that serve images at extension-less paths
const IMAGE_HOSTS = /^https?:\/\/(void\.cat\/d\/|nostr\.build\/i\/|image\.nostr\.build\/|cdn\.nostr\.build\/i\/|nostrimg\.com\/[^/]+\/|files\.sovbit\.host\/|cdn\.satellite\.earth\/|i\.imgur\.com\/|i\.ibb\.co\/[^/]+\/)/i;

type NaddrData = { identifier: string; pubkey: string; ndkKind: number; relays?: string[] };

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'url'; url: string }
  | { kind: 'hashtag'; tag: string }
  | { kind: 'nostr-profile'; pubkey: string; raw: string }
  | { kind: 'nostr-event'; eventId: string; raw: string }
  | { kind: 'nostr-address' } & NaddrData;

const TOKEN_RE = /(https?:\/\/\S+)|(#[\w-￿]+)|(nostr:[a-z0-9]+)/gi;

function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TOKEN_RE.exec(content)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', value: content.slice(last, m.index) });
    const token = m[0];

    if (token.startsWith('nostr:')) {
      try {
        const decoded = nip19.decode(token.slice(6));
        if (decoded.type === 'npub') {
          segments.push({ kind: 'nostr-profile', pubkey: decoded.data as string, raw: token });
        } else if (decoded.type === 'nprofile') {
          segments.push({ kind: 'nostr-profile', pubkey: (decoded.data as { pubkey: string }).pubkey, raw: token });
        } else if (decoded.type === 'note') {
          segments.push({ kind: 'nostr-event', eventId: decoded.data as string, raw: token });
        } else if (decoded.type === 'nevent') {
          segments.push({ kind: 'nostr-event', eventId: (decoded.data as { id: string }).id, raw: token });
        } else if (decoded.type === 'naddr') {
          const d = decoded.data as { identifier: string; pubkey: string; kind: number; relays?: string[] };
          segments.push({ kind: 'nostr-address', identifier: d.identifier, pubkey: d.pubkey, ndkKind: d.kind, relays: d.relays });
        } else {
          segments.push({ kind: 'text', value: token });
        }
      } catch {
        segments.push({ kind: 'text', value: token });
      }
    } else if (token.startsWith('#')) {
      segments.push({ kind: 'hashtag', tag: token.slice(1) });
    } else if (VIDEO_EXT.test(token)) {
      segments.push({ kind: 'video', url: token });
    } else if (IMAGE_EXT.test(token) || IMAGE_HOSTS.test(token)) {
      segments.push({ kind: 'image', url: token });
    } else {
      segments.push({ kind: 'url', url: token });
    }

    last = m.index + token.length;
  }

  if (last < content.length) segments.push({ kind: 'text', value: content.slice(last) });
  return segments;
}

export function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Avatar({
  pubkey, name, picture, size = 9, onClick,
}: { pubkey: string; name?: string; picture?: string; size?: number; onClick?: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (name ?? pubkey).slice(0, 2).toUpperCase();
  const hue = parseInt(pubkey.slice(0, 4), 16) % 360;
  const cls = `w-${size} h-${size} rounded-full shrink-0 focus:outline-none overflow-hidden`;
  const handleClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onClick?.(); }, [onClick]);

  if (picture && !imgFailed) {
    return (
      <button onClick={handleClick} className={cls} aria-label="View profile">
        <img src={picture} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} loading="lazy" />
      </button>
    );
  }
  return (
    <button onClick={handleClick} className={`${cls} flex items-center justify-center text-xs font-medium text-white`}
      style={{ backgroundColor: `hsl(${hue} 60% 45%)` }} aria-label="View profile">
      {initials}
    </button>
  );
}

function NostrProfileMention({ pubkey }: { pubkey: string; raw: string }) {
  const profile = useProfile(pubkey);
  const { push } = useNav();
  const display = profile?.displayName ?? profile?.name ?? truncateNpub(encodePubkey(pubkey));
  return (
    <button onClick={e => { e.stopPropagation(); push({ view: 'profile', pubkey }); }} className="text-accent hover:underline font-medium">
      @{display}
    </button>
  );
}

function EmbeddedNote({ eventId }: { eventId: string }) {
  const { ndk } = useNDK();
  const { push } = useNav();
  const [ev, setEv] = useState<NDKEvent | null>(null);
  useEffect(() => {
    if (!ndk || !eventId) return;
    let cancelled = false;
    ndk.fetchEvent(eventId).then(e => { if (!cancelled) setEv(e); });
    return () => { cancelled = true; };
  }, [ndk, eventId]);
  const authorProfile = useProfile(ev?.pubkey ?? '');
  const authorName = ev ? (authorProfile?.displayName ?? authorProfile?.name ?? truncateNpub(encodePubkey(ev.pubkey))) : null;
  if (!ev) return <span className="inline-block text-xs text-zinc-400 italic">loading note...</span>;
  return (
    <div className="mt-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
        <span className="truncate">{authorName}</span>
        {ev.created_at && <span className="shrink-0 text-zinc-400">{relativeTime(ev.created_at)}</span>}
        <button
          className="ml-auto shrink-0 text-zinc-400 hover:text-accent transition-colors"
          aria-label="Open note"
          onClick={e => { e.stopPropagation(); push({ view: 'event-ref', eventId }); }}
        >
          <IconArrowUpRight size={13} />
        </button>
      </div>
      <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words line-clamp-6 leading-relaxed">{ev.content}</p>
    </div>
  );
}

function EmbeddedAddress({ identifier, pubkey, ndkKind }: NaddrData) {
  const { ndk } = useNDK();
  const { push } = useNav();
  const [ev, setEv] = useState<NDKEvent | null>(null);
  useEffect(() => {
    if (!ndk) return;
    let cancelled = false;
    ndk.fetchEvent({ kinds: [ndkKind], authors: [pubkey], '#d': [identifier] }).then(e => { if (!cancelled) setEv(e); });
    return () => { cancelled = true; };
  }, [ndk, ndkKind, pubkey, identifier]);
  const authorProfile = useProfile(pubkey);
  const authorName = authorProfile?.displayName ?? authorProfile?.name ?? truncateNpub(encodePubkey(pubkey));
  const title = ev?.tags.find(t => t[0] === 'title')?.[1] ?? ev?.tags.find(t => t[0] === 'name')?.[1];
  if (!ev) return <span className="inline-block text-xs text-zinc-400 italic">loading article...</span>;
  const eventId = ev.id;
  return (
    <div className="mt-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
        <span className="truncate">{authorName}</span>
        {ev.created_at && <span className="shrink-0 text-zinc-400">{relativeTime(ev.created_at)}</span>}
        <button
          className="ml-auto shrink-0 text-zinc-400 hover:text-accent transition-colors"
          aria-label="Open article"
          onClick={e => { e.stopPropagation(); push({ view: 'event-ref', eventId }); }}
        >
          <IconArrowUpRight size={13} />
        </button>
      </div>
      {title && <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm leading-snug">{title}</p>}
      <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words line-clamp-4 leading-relaxed text-xs">{ev.content.slice(0, 300)}</p>
    </div>
  );
}

function Lightbox({ url, onClose, onSave, onRepost }: {
  url: string;
  onClose: () => void;
  onSave: () => void;
  onRepost: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onRepost}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
          <IconRepeat size={13} /> Repost note
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
            <IconDownload size={13} /> Save
          </button>
          <button onClick={onClose}
            className="flex items-center justify-center w-7 h-7 text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
            <IconX size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <img src={url} alt="" className="max-w-full max-h-full object-contain select-none" draggable={false} />
      </div>
    </div>
  );
}

// Speculatively tries to load any URL as an image.
// Shows when loaded (with lightbox); stays invisible on error so text link remains.
function TryImage({ url, onImageClick }: { url: string; onImageClick?: (u: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  if (onImageClick) {
    return (
      <button
        onClick={e => { e.stopPropagation(); if (loaded) onImageClick(url); }}
        className={`block w-full text-left ${loaded ? '' : 'hidden'}`}
      >
        <img src={url} alt="" loading="lazy"
          className="rounded-lg max-h-[32rem] max-w-full object-contain cursor-zoom-in"
          onLoad={() => setLoaded(true)}
          onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
        />
      </button>
    );
  }
  return (
    <img src={url} alt="" loading="lazy"
      className={`rounded-lg max-h-[32rem] max-w-full object-contain ${loaded ? 'block' : 'hidden'}`}
      onLoad={() => setLoaded(true)}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

function ContentRenderer({ content, onImageClick }: { content: string; onImageClick?: (url: string) => void }) {
  const { push } = useNav();
  const segments = parseSegments(content);
  const inlineSegs = segments.filter(s => s.kind !== 'image' && s.kind !== 'video' && s.kind !== 'nostr-event' && s.kind !== 'nostr-address');
  const imageSegs = segments.filter(s => s.kind === 'image') as Extract<Segment, { kind: 'image' }>[];
  const urlSegs = segments.filter(s => s.kind === 'url') as Extract<Segment, { kind: 'url' }>[];
  const videoSegs = segments.filter(s => s.kind === 'video') as Extract<Segment, { kind: 'video' }>[];
  const eventSegs = segments.filter(s => s.kind === 'nostr-event') as Extract<Segment, { kind: 'nostr-event' }>[];
  const addressSegs = segments.filter(s => s.kind === 'nostr-address') as (NaddrData & { kind: 'nostr-address' })[];
  const hasText = inlineSegs.some(s => s.kind !== 'text' || s.value.trim().length > 0);
  return (
    <div className="space-y-2">
      {hasText && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
          {inlineSegs.map((seg, i) => {
            if (seg.kind === 'text') return <span key={i}>{seg.value}</span>;
            if (seg.kind === 'hashtag') return (
              <button key={i} onClick={e => { e.stopPropagation(); push({ view: 'search', query: `#${seg.tag}` }); }} className="text-accent hover:underline">#{seg.tag}</button>
            );
            if (seg.kind === 'url') return (
              <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all" onClick={e => e.stopPropagation()}>{seg.url}</a>
            );
            if (seg.kind === 'nostr-profile') return <NostrProfileMention key={i} pubkey={seg.pubkey} raw={seg.raw} />;
            return null;
          })}
        </p>
      )}
      {imageSegs.map((seg, i) => (
        onImageClick ? (
          <button key={i} onClick={e => { e.stopPropagation(); onImageClick(seg.url); }} className="block w-full text-left">
            <img src={seg.url} alt="" loading="lazy" className="rounded-lg max-h-[32rem] max-w-full object-contain cursor-zoom-in"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </button>
        ) : (
          <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <img src={seg.url} alt="" loading="lazy" className="rounded-lg max-h-[32rem] max-w-full object-contain cursor-zoom-in"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </a>
        )
      ))}
      {/* Try every unrecognised URL as a hidden image - shows only when it loads successfully */}
      {urlSegs.map((seg, i) => (
        <TryImage key={`try-${i}`} url={seg.url} onImageClick={onImageClick} />
      ))}
      {videoSegs.map((seg, i) => (
        <video key={i} src={seg.url} controls preload="metadata" className="rounded-lg max-h-[24rem] max-w-full" onClick={e => e.stopPropagation()} />
      ))}
      {eventSegs.map((seg, i) => <EmbeddedNote key={i} eventId={seg.eventId} />)}
      {addressSegs.map((seg, i) => <EmbeddedAddress key={i} identifier={seg.identifier} pubkey={seg.pubkey} ndkKind={seg.ndkKind} relays={seg.relays} />)}
    </div>
  );
}

function StatCount({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="text-xs tabular-nums">{n}</span>;
}

export function NoteCard({ event, pinned = false, onQuote }: { event: NDKEvent; pinned?: boolean; onQuote?: (url: string, eventId: string) => void }) {
  const ts = event.created_at ?? 0;
  const { ndk } = useNDK();
  const { push } = useNav();
  const { session } = useAccount();
  const selfPubkey = session.status === 'unlocked' || session.status === 'locked' ? session.account.pubkey : '';
  const isSelfNote = !!selfPubkey && event.pubkey === selfPubkey;

  const profile = useProfile(event.pubkey);
  const verified = useNip05(profile?.nip05 ?? undefined, event.pubkey);
  const stats = useNoteStats(event.id);
  const bookmarks = useBookmarks();
  const mutes = useMutes();
  const pins = usePins();

  const isBookmarked = bookmarks.has(event.id);
  const isMuted = mutes.has(event.pubkey);
  const isPinned = pins.has(event.id);

  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [zapOpen, setZapOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [cwRevealed, setCwRevealed] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState('');

  const contentWarning = event.tags.find(t => t[0] === 'content-warning');
  const name = profile?.displayName ?? profile?.name;
  const picture = profile?.picture ?? undefined;
  const display = name ?? truncateNpub(encodePubkey(event.pubkey));

  const goProfile = useCallback(() => push({ view: 'profile', pubkey: event.pubkey }), [push, event.pubkey]);
  const goThread = useCallback(() => push({ view: 'thread', event }), [push, event]);

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ndk || liked || liking) return;
    setLiking(true); setLiked(true);
    try { await publishLike(ndk, event); } catch { setLiked(false); } finally { setLiking(false); }
  }, [ndk, liked, liking, event]);

  const handleRepost = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ndk || reposted) return;
    setReposted(true);
    try { await publishRepost(ndk, event); } catch { setReposted(false); }
  }, [ndk, reposted, event]);

  const handleBookmark = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBookmarked) {
      await removeBookmark(event.id);
      if (ndk) publishBookmarkList(ndk, (await getBookmarks())).catch(() => { /* silent */ });
    } else {
      await addBookmark(event.id);
      if (ndk) publishBookmarkList(ndk, (await getBookmarks())).catch(() => { /* silent */ });
    }
  }, [event.id, isBookmarked, ndk]);

  const handleMuteToggle = useCallback(async () => {
    setMenuOpen(false);
    if (isMuted) {
      await removeMute(event.pubkey);
      if (ndk) publishMuteList(ndk, (await getMutes())).catch(() => { /* silent */ });
    } else {
      await addMute(event.pubkey);
      if (ndk) publishMuteList(ndk, (await getMutes())).catch(() => { /* silent */ });
    }
  }, [event.pubkey, isMuted, ndk]);

  const handlePinToggle = useCallback(async () => {
    setMenuOpen(false);
    if (isPinned) {
      await removePin(event.id);
      if (ndk) publishPinList(ndk, (await getPins())).catch(() => { /* silent */ });
    } else {
      await addPin(event.id);
      if (ndk) publishPinList(ndk, (await getPins())).catch(() => { /* silent */ });
    }
  }, [event.id, isPinned, ndk]);

  const handleCopyId = useCallback(async () => {
    setMenuOpen(false);
    await navigator.clipboard.writeText(nip19.noteEncode(event.id));
  }, [event.id]);

  const handleDelete = useCallback(async () => {
    if (!ndk) return;
    setMenuOpen(false);
    setConfirmDelete(false);
    setDeleted(true);
    await publishDeletion(ndk, event.id, event.kind ?? 1).catch(() => setDeleted(false));
  }, [ndk, event.id, event.kind]);

  const handleLightboxRepost = useCallback(async () => {
    if (!ndk || reposted) return;
    setReposted(true);
    try { await publishRepost(ndk, event); } catch { setReposted(false); }
  }, [ndk, reposted, event]);

  const handleLightboxSave = useCallback(async () => {
    try {
      const response = await fetch(lightboxUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = lightboxUrl.split('/').pop()?.split('?')[0] ?? 'image';
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(lightboxUrl, '_blank');
    }
  }, [lightboxUrl]);

  if (deleted) return null;

  const totalLikes = stats.likes + (liked ? 1 : 0);
  const totalReposts = stats.reposts + (reposted ? 1 : 0);

  return (
    <article
      className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
      onClick={goThread}
    >
      {pinned && (
        <div className="flex items-center gap-1 text-xs text-zinc-400 mb-1 ml-12">
          <IconPin size={11} /> Pinned
        </div>
      )}
      <div className="flex gap-3">
        <Avatar pubkey={event.pubkey} name={name} picture={picture} onClick={goProfile} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); goProfile(); }}
              className="text-sm font-medium truncate hover:underline text-left focus:outline-none">{display}</button>
            {verified && <IconRosetteDiscountCheckFilled size={14} className="text-accent shrink-0" aria-label="NIP-05 verified" />}
            <span className="text-xs text-zinc-400 shrink-0 ml-auto">{relativeTime(ts)}</span>
          </div>

          {contentWarning && !cwRevealed ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-medium">
                <IconAlertTriangle size={13} />
                Content warning{contentWarning[1] ? `: ${contentWarning[1]}` : ''}
              </div>
              <button onClick={e => { e.stopPropagation(); setCwRevealed(true); }}
                className="text-xs text-accent hover:underline">Show anyway</button>
            </div>
          ) : (
            <ContentRenderer content={event.content} onImageClick={url => { setLightboxUrl(url); }} />
          )}

          <div className="flex items-center gap-4 pt-1">
            <button onClick={e => { e.stopPropagation(); goThread(); }}
              className="flex items-center gap-1 text-zinc-400 hover:text-accent transition-colors" aria-label="Reply">
              <IconArrowForwardUp size={15} />
            </button>
            <button onClick={handleRepost}
              className={`flex items-center gap-1.5 transition-colors ${reposted ? 'text-green-500' : 'text-zinc-400 hover:text-green-500'}`} aria-label="Repost">
              <IconRepeat size={15} /><StatCount n={totalReposts} />
            </button>
            <button onClick={handleLike}
              className={`flex items-center gap-1.5 transition-colors ${liked ? 'text-red-500' : 'text-zinc-400 hover:text-red-500'}`} aria-label="Like">
              <IconHeart size={15} fill={liked ? 'currentColor' : 'none'} /><StatCount n={totalLikes} />
            </button>
            <button onClick={e => { e.stopPropagation(); setZapOpen(true); }}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zap transition-colors" aria-label="Zap">
              <IconBolt size={15} /><StatCount n={stats.zaps} />
            </button>
            <button onClick={handleBookmark}
              className={`flex items-center gap-1 transition-colors ${isBookmarked ? 'text-accent' : 'text-zinc-400 hover:text-accent'}`} aria-label="Bookmark">
              {isBookmarked ? <IconBookmarkFilled size={15} /> : <IconBookmark size={15} />}
            </button>
            <div className="relative ml-auto">
              <button onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" aria-label="More options">
                <IconDots size={15} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setMenuOpen(false); setConfirmDelete(false); }} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-50">
                    {!isSelfNote && (
                      <button onClick={e => { e.stopPropagation(); void handleMuteToggle(); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        {isMuted ? 'Unmute user' : 'Mute user'}
                      </button>
                    )}
                    {isSelfNote && (
                      <button onClick={e => { e.stopPropagation(); void handlePinToggle(); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2">
                        <IconPin size={12} />
                        {isPinned ? 'Unpin from profile' : 'Pin to profile'}
                      </button>
                    )}
                    {isSelfNote && (
                      confirmDelete ? (
                        <div className="px-3 py-1.5 text-xs flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <span className="flex-1 text-red-500">Delete?</span>
                          <button onClick={e => { e.stopPropagation(); void handleDelete(); }}
                            className="text-red-500 hover:text-red-600 font-medium">Yes</button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">No</button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2">
                          <IconTrash size={12} />
                          Delete note
                        </button>
                      )
                    )}
                    {onQuote && (
                      <button onClick={e => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onQuote(`\n\nnostr:${nip19.neventEncode({ id: event.id, author: event.pubkey })}`, event.id);
                      }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2">
                        <IconBlockquote size={12} />
                        Quote
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); void handleCopyId(); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                      Copy note ID
                    </button>
                    <a
                      href={`https://njump.me/${nip19.neventEncode({ id: event.id, author: event.pubkey })}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => { e.stopPropagation(); setMenuOpen(false); }}
                      className="block w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Share on njump.me
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {zapOpen && <ZapModal event={event} onClose={() => setZapOpen(false)} />}
      {lightboxUrl && (
        <Lightbox
          url={lightboxUrl}
          onClose={() => setLightboxUrl('')}
          onSave={() => void handleLightboxSave()}
          onRepost={() => void handleLightboxRepost()}
        />
      )}
    </article>
  );
}
