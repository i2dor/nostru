import { describe, it, expect } from 'vitest';
import { parseNIP10, buildReplyTags } from './nip10';

describe('parseNIP10', () => {
  it('returns nulls for an event with no e-tags', () => {
    const refs = parseNIP10([['p', 'abc']]);
    expect(refs.root).toBeNull();
    expect(refs.reply).toBeNull();
    expect(refs.mentions).toHaveLength(0);
  });

  it('marked format: identifies root and reply by marker', () => {
    const rootId = 'a'.repeat(64);
    const replyId = 'b'.repeat(64);
    const tags = [
      ['e', rootId, '', 'root'],
      ['e', replyId, '', 'reply'],
    ];
    const refs = parseNIP10(tags);
    expect(refs.root?.id).toBe(rootId);
    expect(refs.reply?.id).toBe(replyId);
    expect(refs.mentions).toHaveLength(0);
  });

  it('marked format: collects mention tags', () => {
    const tags = [
      ['e', 'a'.repeat(64), '', 'root'],
      ['e', 'b'.repeat(64), '', 'mention'],
      ['e', 'c'.repeat(64), '', 'reply'],
    ];
    const refs = parseNIP10(tags);
    expect(refs.mentions).toHaveLength(1);
    expect(refs.mentions[0].id).toBe('b'.repeat(64));
  });

  it('unmarked format (1 e-tag): same event is root and reply', () => {
    const id = 'a'.repeat(64);
    const refs = parseNIP10([['e', id]]);
    expect(refs.root?.id).toBe(id);
    expect(refs.reply?.id).toBe(id);
  });

  it('unmarked format (2 e-tags): first is root, last is reply', () => {
    const rootId = 'a'.repeat(64);
    const replyId = 'b'.repeat(64);
    const refs = parseNIP10([['e', rootId], ['e', replyId]]);
    expect(refs.root?.id).toBe(rootId);
    expect(refs.reply?.id).toBe(replyId);
  });

  it('unmarked format (3 e-tags): middle tags become mentions', () => {
    const ids = ['a', 'b', 'c'].map(c => c.repeat(64));
    const refs = parseNIP10(ids.map(id => ['e', id]));
    expect(refs.root?.id).toBe(ids[0]);
    expect(refs.reply?.id).toBe(ids[2]);
    expect(refs.mentions[0].id).toBe(ids[1]);
  });
});

describe('buildReplyTags', () => {
  it('when parent has no root, parent id becomes root and reply', () => {
    const parent = { id: 'a'.repeat(64), pubkey: 'b'.repeat(64), tags: [] };
    const tags = buildReplyTags(parent);
    const eTags = tags.filter(t => t[0] === 'e');
    expect(eTags).toHaveLength(1);
    expect(eTags[0][1]).toBe(parent.id);
    expect(eTags[0][3]).toBe('reply');
    expect(tags.some(t => t[0] === 'p' && t[1] === parent.pubkey)).toBe(true);
  });

  it('when parent has a root, reply tags include both root and reply', () => {
    const rootId = 'a'.repeat(64);
    const parentId = 'b'.repeat(64);
    const parent = {
      id: parentId,
      pubkey: 'c'.repeat(64),
      tags: [['e', rootId, '', 'root'], ['e', parentId, '', 'reply']],
    };
    const tags = buildReplyTags(parent);
    const eTags = tags.filter(t => t[0] === 'e');
    expect(eTags.find(t => t[3] === 'root')?.[1]).toBe(rootId);
    expect(eTags.find(t => t[3] === 'reply')?.[1]).toBe(parentId);
  });
});
