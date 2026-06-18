import { useEffect, useState } from 'react';
import { useNDK } from '../../core/ndk';
import { useProfile, useFollows, useFeed } from '../feed/hooks';
import { follow, unfollow } from '../../core/events/follows';
import { NoteCard } from '../components/NoteCard';
import { encodePubkey, truncateNpub } from '../../core/keys';
import { useAccount } from '../context/AccountContext';

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

function Avatar({ pubkey, name }: { pubkey: string; name?: string }) {
  const initials = (name ?? pubkey).slice(0, 2).toUpperCase();
  const hue = parseInt(pubkey.slice(0, 4), 16) % 360;
  return (
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-medium text-white shrink-0"
      style={{ backgroundColor: `hsl(${hue} 60% 45%)` }}
    >
      {initials}
    </div>
  );
}

export function ProfileView({ pubkey }: { pubkey: string }) {
  const { session } = useAccount();
  const selfPubkey = session.status === 'unlocked' ? session.account.pubkey : '';
  const isSelf = selfPubkey === pubkey;

  const { ndk } = useNDK();
  const profile = useProfile(pubkey);
  const followList = useFollows(selfPubkey);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (followList !== null) {
      setIsFollowing(followList.includes(pubkey));
    }
  }, [followList, pubkey]);

  const handleFollowToggle = async () => {
    if (!ndk || followList === null || isFollowing === null || followBusy) return;
    const optimistic = !isFollowing;
    setIsFollowing(optimistic);
    setFollowBusy(true);
    try {
      if (optimistic) {
        await follow(ndk, pubkey, followList);
      } else {
        await unfollow(ndk, pubkey, followList);
      }
    } catch {
      setIsFollowing(!optimistic);
    } finally {
      setFollowBusy(false);
    }
  };

  const { events, eose } = useFeed({ kinds: [1], authors: [pubkey], limit: 20 }, !!ndk);

  const npub = truncateNpub(encodePubkey(pubkey));
  const displayName = profile?.displayName ?? profile?.name ?? npub;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <Avatar pubkey={pubkey} name={profile?.displayName ?? profile?.name} />
          {!isSelf && (
            <button
              onClick={handleFollowToggle}
              disabled={followBusy || isFollowing === null}
              className={`mt-1 px-4 py-1.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${
                isFollowing
                  ? 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-red-400 hover:text-red-500'
                  : 'bg-accent border-accent text-white hover:bg-accent/90'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <div>
          <p className="font-semibold text-sm">{displayName}</p>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">{npub}</p>
          {profile?.about && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">{profile.about}</p>
          )}
        </div>
      </div>

      <div>
        {!eose && events.length === 0 && <Spinner />}
        {events.map(ev => <NoteCard key={ev.id} event={ev} />)}
        {eose && events.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-8">No notes yet.</p>
        )}
      </div>
    </div>
  );
}
