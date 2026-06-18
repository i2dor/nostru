import { useState, useEffect, useCallback } from 'react';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNDK } from '../../core/ndk';
import { useAccount } from '../context/AccountContext';
import { bytesToHex } from '../../core/keys';
import { decryptNip17GiftWrap, sendNip17 } from '../../core/dm/nip17';
import { decryptNip04, sendNip04 } from '../../core/dm/nip04';
import type { DecryptedMessage, Conversation } from '../../core/dm/types';

export function useConversations(): Conversation[] {
  const { session } = useAccount();
  const { ndk } = useNDK();
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);

  const myPubkey = session.status === 'unlocked' ? session.account.pubkey : '';
  const privkey = session.status === 'unlocked' ? session.privkey : null;

  useEffect(() => {
    if (!ndk || !privkey || !myPubkey) return;
    const privkeyHex = bytesToHex(privkey);

    function addMessage(msg: DecryptedMessage) {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    }

    const sub17 = ndk.subscribe(
      { kinds: [1059 as number], '#p': [myPubkey] },
      { closeOnEose: false },
    );
    sub17.on('event', (ev: NDKEvent) => {
      const msg = decryptNip17GiftWrap(ev.rawEvent() as Parameters<typeof decryptNip17GiftWrap>[0], privkeyHex, myPubkey);
      if (msg) addMessage(msg);
    });

    const sub04In = ndk.subscribe(
      { kinds: [4 as number], '#p': [myPubkey] },
      { closeOnEose: false },
    );
    sub04In.on('event', async (ev: NDKEvent) => {
      const msg = await decryptNip04(ev.rawEvent() as Parameters<typeof decryptNip04>[0], myPubkey, privkeyHex);
      if (msg) addMessage(msg);
    });

    const sub04Out = ndk.subscribe(
      { kinds: [4 as number], authors: [myPubkey] },
      { closeOnEose: false },
    );
    sub04Out.on('event', async (ev: NDKEvent) => {
      const msg = await decryptNip04(ev.rawEvent() as Parameters<typeof decryptNip04>[0], myPubkey, privkeyHex);
      if (msg) addMessage(msg);
    });

    return () => { sub17.stop(); sub04In.stop(); sub04Out.stop(); };
  }, [ndk, myPubkey, privkey]);

  if (!myPubkey) return [];

  const byPeer: Record<string, DecryptedMessage[]> = {};
  for (const msg of messages) {
    const peer = msg.from === myPubkey ? msg.to : msg.from;
    (byPeer[peer] ??= []).push(msg);
  }

  return Object.entries(byPeer)
    .map(([peerPubkey, msgs]) => {
      const sorted = [...msgs].sort((a, b) => a.timestamp - b.timestamp);
      return { peerPubkey, messages: sorted, lastMessage: sorted[sorted.length - 1] ?? null };
    })
    .sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0));
}

export function useSendDM() {
  const { session } = useAccount();
  const { ndk } = useNDK();

  return useCallback(async (
    recipientPubkey: string,
    content: string,
    protocol: 'nip17' | 'nip04' = 'nip17',
  ) => {
    if (!ndk) throw new Error('Not connected');
    if (session.status !== 'unlocked') throw new Error('Wallet locked');
    const privkeyHex = bytesToHex(session.privkey);
    if (protocol === 'nip04') {
      await sendNip04(ndk, privkeyHex, recipientPubkey, content);
    } else {
      await sendNip17(ndk, privkeyHex, recipientPubkey, content);
    }
  }, [ndk, session]);
}
