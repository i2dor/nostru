export interface NIP10Ref {
  id: string;
  relay?: string;
}

export interface NIP10Refs {
  root: NIP10Ref | null;
  reply: NIP10Ref | null;
  mentions: NIP10Ref[];
}

export function parseNIP10(tags: string[][]): NIP10Refs {
  const eTags = tags.filter(t => t[0] === 'e');

  const hasMarkers = eTags.some(t => t[3] === 'root' || t[3] === 'reply' || t[3] === 'mention');

  if (hasMarkers) {
    const rootTag = eTags.find(t => t[3] === 'root');
    const replyTag = eTags.find(t => t[3] === 'reply');
    const mentionTags = eTags.filter(t => t[3] === 'mention');
    return {
      root: rootTag ? { id: rootTag[1], relay: rootTag[2] || undefined } : null,
      reply: replyTag ? { id: replyTag[1], relay: replyTag[2] || undefined } : null,
      mentions: mentionTags.map(t => ({ id: t[1], relay: t[2] || undefined })),
    };
  }

  if (eTags.length === 0) return { root: null, reply: null, mentions: [] };

  if (eTags.length === 1) {
    const ref = { id: eTags[0][1], relay: eTags[0][2] || undefined };
    return { root: ref, reply: ref, mentions: [] };
  }

  return {
    root: { id: eTags[0][1], relay: eTags[0][2] || undefined },
    reply: { id: eTags[eTags.length - 1][1], relay: eTags[eTags.length - 1][2] || undefined },
    mentions: eTags.slice(1, -1).map(t => ({ id: t[1], relay: t[2] || undefined })),
  };
}

export function buildReplyTags(parent: {
  id: string;
  pubkey: string;
  tags: string[][];
}): string[][] {
  const refs = parseNIP10(parent.tags);
  const rootId = refs.root?.id;
  const tags: string[][] = [['p', parent.pubkey]];

  if (rootId && rootId !== parent.id) {
    tags.push(['e', rootId, '', 'root']);
  }
  tags.push(['e', parent.id, '', 'reply']);

  return tags;
}
