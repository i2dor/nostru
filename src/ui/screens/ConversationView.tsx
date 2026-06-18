import { useState, useRef, useEffect, useCallback } from 'react';
import { IconSend } from '@tabler/icons-react';
import { useConversations, useSendDM } from '../messages/hooks';
import { useAccount } from '../context/AccountContext';
import { useProfile } from '../feed/hooks';
import { encodePubkey, truncateNpub } from '../../core/keys';
import type { DecryptedMessage } from '../../core/dm/types';

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg, isMine }: { msg: DecryptedMessage; isMine: boolean }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
          isMine
            ? 'bg-accent text-white rounded-br-sm'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
        }`}
      >
        <p className="break-words">{msg.content}</p>
        <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-zinc-400'}`}>
          {formatTime(msg.timestamp)}
        </p>
      </div>
    </div>
  );
}

export function ConversationView({ peerPubkey }: { peerPubkey: string }) {
  const { session } = useAccount();
  const conversations = useConversations();
  const sendDM = useSendDM();
  const profile = useProfile(peerPubkey);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const myPubkey = session.status === 'unlocked' ? session.account.pubkey : '';
  const conversation = conversations.find(c => c.peerPubkey === peerPubkey);
  const messages = conversation?.messages ?? [];
  // Reply using the same protocol the peer used, so older NIP-04 clients see our replies.
  const peerProtocol = [...messages].reverse().find(m => m.from === peerPubkey)?.protocol ?? 'nip17';
  const display = profile?.displayName ?? profile?.name ?? truncateNpub(encodePubkey(peerPubkey));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    try {
      await sendDM(peerPubkey, trimmed, peerProtocol);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }, [text, sending, sendDM, peerPubkey, peerProtocol]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <p className="text-sm font-medium truncate">{display}</p>
        <p className="text-xs text-zinc-400 font-mono truncate">{encodePubkey(peerPubkey).slice(0, 20)}...</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-zinc-400 mt-8">No messages yet. Say hello!</p>
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} isMine={msg.from === myPubkey} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message..."
            className="flex-1 px-3 py-2 text-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent resize-none max-h-28 overflow-y-auto"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!text.trim() || sending}
            aria-label="Send"
            className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            {sending
              ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <IconSend size={15} />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
