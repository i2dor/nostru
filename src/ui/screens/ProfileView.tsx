import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  IconRosetteDiscountCheckFilled,
  IconPencil,
  IconCheck,
  IconX,
  IconMail,
  IconBolt,
  IconHeart,
  IconBan,
  IconEyeOff,
  IconPin,
  IconCurrencyBitcoin,
  IconCopy,
} from '@tabler/icons-react';
import { deriveNspAddress } from '../../core/nsp';
import { zapInvoiceFromEvent, type NDKEvent } from '@nostr-dev-kit/ndk';
import { useNDK } from '../../core/ndk';
import { useProfile, useFollows, useFeed, useNip05, useBlocks, useMutes } from '../feed/hooks';
import { addBlock, removeBlock } from '../../core/store/blocks';
import { addMute, removeMute, getMutes } from '../../core/store/mutes';
import { publishMuteList, fetchNip51List } from '../../core/events/lists';
import { follow, unfollow } from '../../core/events/follows';
import { publishProfile } from '../../core/events/publish';
import { NoteCard } from '../components/NoteCard';
import { ZapModal } from '../components/ZapModal';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { useAccount } from '../context/AccountContext';
import { useNav } from '../context/NavContext';

const IMAGE_RE = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|avif)(?:[?#]\S*)?/i;

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes' | 'zaps' | 'you';

function isReply(ev: NDKEvent): boolean {
  return ev.tags.some(t => t[0] === 'e');
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

function ProfileAvatar({ pubkey, name, picture }: { pubkey: string; name?: string; picture?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (name ?? pubkey).slice(0, 2).toUpperCase();
  const hue = parseInt(pubkey.slice(0, 4), 16) % 360;

  if (picture && !imgFailed) {
    return (
      <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-white dark:border-zinc-900">
        <img
          src={picture}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-medium text-white shrink-0 border-2 border-white dark:border-zinc-900"
      style={{ backgroundColor: `hsl(${hue} 60% 45%)` }}
    >
      {initials}
    </div>
  );
}

function LikeCard({ event }: { event: NDKEvent }) {
  const ts = event.created_at ?? 0;
  const reaction = event.content || '+';
  const eTag = event.tags.find(t => t[0] === 'e')?.[1];
  const label = eTag ? `${eTag.slice(0, 8)}...` : 'a note';

  return (
    <article className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
      <span className="text-lg mt-0.5">{reaction === '+' ? '❤' : reaction}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Liked <span className="font-mono text-xs">{label}</span>
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {new Date(ts * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <IconHeart size={14} className="text-red-400 shrink-0 mt-1" />
    </article>
  );
}

function ZapSenderName({ pubkey }: { pubkey: string }) {
  const profile = useProfile(pubkey);
  return <>{profile?.displayName ?? profile?.name ?? truncateNpub(encodePubkey(pubkey))}</>;
}

function ZapCard({ event }: { event: NDKEvent }) {
  const invoice = zapInvoiceFromEvent(event);
  const ts = event.created_at ?? 0;
  const sats = invoice ? Math.round(invoice.amount / 1000) : null;
  const sender = invoice?.zappee ?? null;

  return (
    <article className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
      <IconBolt size={16} className="text-zap shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {sender ? <ZapSenderName pubkey={sender} /> : 'Someone'}
          {sats !== null && <span className="font-semibold text-zap"> zapped {sats.toLocaleString()} sats</span>}
          {invoice?.comment && <span className="text-zinc-500"> &middot; {invoice.comment}</span>}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {new Date(ts * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </article>
  );
}

function NspRow({ pubkey }: { pubkey: string }) {
  const [copied, setCopied] = useState(false);
  const address = useMemo(() => {
    try { return deriveNspAddress(pubkey); } catch { return null; }
  }, [pubkey]);

  if (!address) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <IconCurrencyBitcoin size={13} className="text-amber-500 shrink-0" />
      <span className="text-xs font-mono text-zinc-400 truncate flex-1" title={address}>
        {address.slice(0, 24)}...
      </span>
      <button
        onClick={handleCopy}
        title="Copy Silent Payment address"
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0"
      >
        {copied ? <IconCheck size={12} className="text-green-500" /> : <IconCopy size={12} />}
      </button>
    </div>
  );
}

interface EditState {
  name: string;
  displayName: string;
  about: string;
  website: string;
  lud16: string;
}

const EDIT_FIELDS = [
  { key: 'displayName', label: 'Display name', placeholder: 'Your display name' },
  { key: 'name', label: 'Username', placeholder: 'username' },
  { key: 'about', label: 'About', placeholder: 'Short bio' },
  { key: 'website', label: 'Website', placeholder: 'https://...' },
  { key: 'lud16', label: 'Lightning address', placeholder: 'you@wallet.com' },
] as const;

export function ProfileView({ pubkey }: { pubkey: string }) {
  const { session } = useAccount();
  const selfPubkey = session.status === 'unlocked' ? session.account.pubkey : '';
  const isSelf = selfPubkey === pubkey;

  const { ndk } = useNDK();
  const { push } = useNav();
  const profile = useProfile(pubkey);
  const verified = useNip05(profile?.nip05 ?? undefined, pubkey);
  const followList = useFollows(selfPubkey);
  const blocks = useBlocks();
  const mutes = useMutes();
  const isBlocked = blocks.has(pubkey);
  const isMuted = mutes.has(pubkey);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);
  const [pinnedEvents, setPinnedEvents] = useState<NDKEvent[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zapOpen, setZapOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [editState, setEditState] = useState<EditState>({
    name: '', displayName: '', about: '', website: '', lud16: '',
  });

  const TABS: { id: ProfileTab; label: string }[] = [
    { id: 'posts', label: 'Posts' },
    { id: 'replies', label: 'Replies' },
    { id: 'media', label: 'Media' },
    { id: 'likes', label: 'Likes' },
    { id: 'zaps', label: 'Zaps' },
    ...(!isSelf && selfPubkey ? [{ id: 'you' as ProfileTab, label: 'You' }] : []),
  ];

  useEffect(() => {
    if (followList !== null) setIsFollowing(followList.includes(pubkey));
  }, [followList, pubkey]);

  const startEdit = useCallback(() => {
    setEditState({
      name: profile?.name ?? '',
      displayName: profile?.displayName ?? '',
      about: profile?.about ?? '',
      website: profile?.website ?? '',
      lud16: profile?.lud16 ?? '',
    });
    setEditing(true);
  }, [profile]);

  const handleSave = useCallback(async () => {
    if (!ndk || saving) return;
    setSaving(true);
    try {
      const meta: Record<string, string> = {};
      if (editState.name) meta.name = editState.name;
      if (editState.displayName) meta.display_name = editState.displayName;
      if (editState.about) meta.about = editState.about;
      if (editState.website) meta.website = editState.website;
      if (editState.lud16) meta.lud16 = editState.lud16;
      await publishProfile(ndk, meta);
      setEditing(false);
    } catch {
      // keep editing open on failure
    } finally {
      setSaving(false);
    }
  }, [ndk, saving, editState]);

  useEffect(() => {
    if (!ndk) return;
    let cancelled = false;
    fetchNip51List(ndk, pubkey, 10001).then(async ids => {
      if (cancelled || ids.length === 0) return;
      const evSet = await ndk.fetchEvents({ ids });
      if (!cancelled) setPinnedEvents(Array.from(evSet));
    });
    return () => { cancelled = true; };
  }, [ndk, pubkey]);

  const handleMuteToggle = async () => {
    if (muteBusy) return;
    setMuteBusy(true);
    try {
      if (isMuted) {
        await removeMute(pubkey);
        if (ndk) publishMuteList(ndk, await getMutes()).catch(() => { /* silent */ });
      } else {
        await addMute(pubkey);
        if (ndk) publishMuteList(ndk, await getMutes()).catch(() => { /* silent */ });
      }
    } finally {
      setMuteBusy(false);
    }
  };

  const handleBlockToggle = async () => {
    if (blockBusy) return;
    setBlockBusy(true);
    try {
      if (isBlocked) await removeBlock(pubkey);
      else await addBlock(pubkey);
    } finally {
      setBlockBusy(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!ndk || followList === null || isFollowing === null || followBusy) return;
    const optimistic = !isFollowing;
    setIsFollowing(optimistic);
    setFollowBusy(true);
    try {
      if (optimistic) await follow(ndk, pubkey, followList);
      else await unfollow(ndk, pubkey, followList);
    } catch {
      setIsFollowing(!optimistic);
    } finally {
      setFollowBusy(false);
    }
  };

  const profileFollows = useFollows(pubkey);
  const followerFeed = useFeed({ kinds: [3], '#p': [pubkey], limit: 1000 }, !!ndk);
  const followerCount = useMemo(
    () => new Set(followerFeed.events.map(e => e.pubkey)).size,
    [followerFeed.events],
  );

  const kind1 = useFeed({ kinds: [1], authors: [pubkey], limit: 100 }, !!ndk);
  const likeFeed = useFeed(
    { kinds: [7], authors: [pubkey], limit: 50 },
    !!ndk && activeTab === 'likes',
  );
  const zapFeed = useFeed(
    { kinds: [9735], '#p': [pubkey], limit: 50 },
    !!ndk && activeTab === 'zaps',
  );
  const youFeed = useFeed(
    { kinds: [1, 6, 7, 9735] as number[], authors: [pubkey], '#p': [selfPubkey], limit: 100 },
    !!ndk && activeTab === 'you' && !isSelf && !!selfPubkey,
  );

  const posts = kind1.events.filter(ev => !isReply(ev));
  const replies = kind1.events.filter(isReply);
  const media = kind1.events.filter(ev => IMAGE_RE.test(ev.content));

  const tabContent: () => { events: NDKEvent[] | null; eose: boolean; component?: 'like' | 'zap' } = () => {
    switch (activeTab) {
      case 'posts': return { events: posts, eose: kind1.eose };
      case 'replies': return { events: replies, eose: kind1.eose };
      case 'media': return { events: media, eose: kind1.eose };
      case 'likes': return { events: likeFeed.events, eose: likeFeed.eose, component: 'like' };
      case 'zaps': return { events: zapFeed.events, eose: zapFeed.eose, component: 'zap' };
      case 'you': return { events: youFeed.events, eose: youFeed.eose };
      default: return { events: [], eose: true };
    }
  };

  const { events, eose, component } = tabContent();

  const npub = truncateNpub(encodePubkey(pubkey));
  const displayName = profile?.displayName ?? profile?.name ?? npub;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="overflow-y-auto flex-1">
        {profile?.banner && (
          <div className="h-24 w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
            <img src={profile.banner} alt="" className="w-full h-full object-cover" loading="lazy"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}

        <div className="px-4 pt-3 pb-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <ProfileAvatar
              pubkey={pubkey}
              name={profile?.displayName ?? profile?.name}
              picture={profile?.picture ?? undefined}
            />
            <div className="flex items-center gap-2 pb-1">
              {!isSelf && (
                <>
                  <button
                    onClick={() => push({ view: 'conversation', peerPubkey: pubkey })}
                    title="Direct message"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-accent hover:text-accent transition-colors"
                  >
                    <IconMail size={12} /> DM
                  </button>
                  {profile?.lud16 && (
                    <button
                      onClick={() => setZapOpen(true)}
                      title="Zap"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-zap hover:text-zap transition-colors"
                    >
                      <IconBolt size={12} /> Zap
                    </button>
                  )}
                  <button
                    onClick={handleFollowToggle}
                    disabled={followBusy || isFollowing === null}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${
                      isFollowing
                        ? 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-red-400 hover:text-red-500'
                        : 'bg-accent border-accent text-white hover:bg-accent/90'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={() => void handleMuteToggle()}
                    disabled={muteBusy}
                    title={isMuted ? 'Unmute' : 'Mute'}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${
                      isMuted
                        ? 'border-amber-400 text-amber-500 hover:border-zinc-300 hover:text-zinc-500'
                        : 'border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:border-amber-400 hover:text-amber-500'
                    }`}
                  >
                    <IconEyeOff size={12} />
                    {isMuted ? 'Muted' : 'Mute'}
                  </button>
                  <button
                    onClick={() => void handleBlockToggle()}
                    disabled={blockBusy}
                    title={isBlocked ? 'Unblock' : 'Block'}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${
                      isBlocked
                        ? 'border-red-400 text-red-500 hover:border-zinc-300 hover:text-zinc-500'
                        : 'border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:border-red-400 hover:text-red-500'
                    }`}
                  >
                    <IconBan size={12} />
                    {isBlocked ? 'Blocked' : 'Block'}
                  </button>
                </>
              )}
              {isSelf && !editing && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-accent hover:text-accent transition-colors"
                >
                  <IconPencil size={12} /> Edit
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <div className="space-y-2">
              {EDIT_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-zinc-400 block mb-0.5">{label}</label>
                  <input
                    value={editState[key]}
                    onChange={e => setEditState(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-2 py-1.5 text-sm rounded border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  {saving
                    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <IconCheck size={12} />
                  }
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  <IconX size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm">{displayName}</p>
                {verified && (
                  <IconRosetteDiscountCheckFilled size={14} className="text-accent shrink-0" aria-label="NIP-05 verified" />
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{npub}</p>
              {profile?.nip05 && (
                <p className="text-xs text-zinc-400 mt-0.5">{profile.nip05}</p>
              )}
              {profile?.about && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">{profile.about}</p>
              )}
              {profile?.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent mt-1 truncate block hover:underline"
                >
                  {profile.website}
                </a>
              )}
              <div className="flex gap-4 mt-2 text-sm">
                <span>
                  <span className="font-semibold">{profileFollows !== null ? profileFollows.length : '-'}</span>
                  <span className="text-zinc-400 ml-1">following</span>
                </span>
                <span>
                  <span className="font-semibold">{followerCount > 0 ? followerCount : '-'}</span>
                  <span className="text-zinc-400 ml-1">followers</span>
                </span>
              </div>
              <NspRow pubkey={pubkey} />
            </div>
          )}
        </div>

        <nav className="flex border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto shrink-0">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div>
          {activeTab === 'posts' && pinnedEvents.length > 0 && (
            <div className="border-b border-zinc-100 dark:border-zinc-800">
              {pinnedEvents.map(ev => (
                <div key={`pin-${ev.id}`} className="relative">
                  <div className="flex items-center gap-1 px-4 pt-2 text-xs text-zinc-400">
                    <IconPin size={11} /> Pinned
                  </div>
                  <NoteCard event={ev} pinned />
                </div>
              ))}
            </div>
          )}
          {!eose && (events === null || events.length === 0) && <Spinner />}
          {eose && events !== null && events.length === 0 && (
            <p className="text-center text-zinc-400 text-sm py-8">Nothing here yet.</p>
          )}
          {events !== null && events.map(ev => {
            if (component === 'like') return <LikeCard key={ev.id} event={ev} />;
            if (component === 'zap') return <ZapCard key={ev.id} event={ev} />;
            if (ev.kind === 7) return <LikeCard key={ev.id} event={ev} />;
            if (ev.kind === 9735) return <ZapCard key={ev.id} event={ev} />;
            return <NoteCard key={ev.id} event={ev} />;
          })}
        </div>
      </div>

      {zapOpen && profile && (
        <ZapModal
          event={{ pubkey, id: '', content: '' } as unknown as NDKEvent}
          onClose={() => setZapOpen(false)}
        />
      )}
    </div>
  );
}
