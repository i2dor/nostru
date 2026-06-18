import NDK, { NDKSubscriptionCacheUsage, type NDKEvent, type NDKFilter, type NDKUserProfile } from '@nostr-dev-kit/ndk';
import { useEffect, useRef, useState } from 'react';
import { useNDK } from '../../core/ndk';

export function useFeed(filter: NDKFilter, enabled: boolean): { events: NDKEvent[]; eose: boolean } {
  const { ndk } = useNDK();
  const [map, setMap] = useState<Map<string, NDKEvent>>(new Map());
  const [eose, setEose] = useState(false);
  const filterRef = useRef(filter);
  filterRef.current = filter; // always current before effect runs

  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    if (!ndk || !enabled) return;
    setMap(new Map());
    setEose(false);

    const sub = ndk.subscribe(filterRef.current, { closeOnEose: false });

    sub.on('event', (ev: NDKEvent) => {
      setMap(prev => {
        const next = new Map(prev);
        next.set(ev.id, ev);
        return next;
      });
    });

    sub.on('eose', () => setEose(true));

    return () => sub.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndk, enabled, filterKey]);

  const events = Array.from(map.values()).sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
  return { events, eose };
}

export function useFollows(pubkey: string | null): string[] | null {
  const { ndk } = useNDK();
  const [follows, setFollows] = useState<string[] | null>(null);

  useEffect(() => {
    if (!ndk || !pubkey) return;
    let cancelled = false;

    ndk.fetchEvent({ kinds: [3], authors: [pubkey] }).then(ev => {
      if (cancelled || !ev) return;
      const pubkeys = ev.tags.filter(t => t[0] === 'p' && t[1]).map(t => t[1]);
      setFollows(pubkeys);
    });

    return () => { cancelled = true; };
  }, [ndk, pubkey]);

  return follows;
}

export function useProfile(pubkey: string): NDKUserProfile | null {
  const { ndk } = useNDK();
  const [profile, setProfile] = useState<NDKUserProfile | null>(null);

  useEffect(() => {
    if (!ndk) return;
    let cancelled = false;
    const user = ndk.getUser({ pubkey });
    user.fetchProfile().then(p => {
      if (!cancelled) setProfile(p ?? null);
    });
    return () => { cancelled = true; };
  }, [ndk, pubkey]);

  return profile;
}

export function useGlobalFeed(ndk: NDK | null): { events: NDKEvent[]; eose: boolean } {
  const [map, setMap] = useState<Map<string, NDKEvent>>(new Map());
  const [eose, setEose] = useState(false);

  useEffect(() => {
    if (!ndk) return;
    setMap(new Map());
    setEose(false);

    const sub = ndk.subscribe(
      { kinds: [1], limit: 50 },
      { closeOnEose: true, cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY },
    );

    sub.on('event', (ev: NDKEvent) => {
      setMap(prev => {
        const next = new Map(prev);
        next.set(ev.id, ev);
        return next;
      });
    });

    sub.on('eose', () => setEose(true));

    return () => sub.stop();
  }, [ndk]);

  return {
    events: Array.from(map.values()).sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)).slice(0, 100),
    eose,
  };
}
