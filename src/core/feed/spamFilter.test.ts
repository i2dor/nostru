import { describe, it, expect } from 'vitest';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { isSpam } from './spamFilter';

function makeEvent(content: string, tags: string[][] = []): NDKEvent {
  return { content, tags } as unknown as NDKEvent;
}

describe('isSpam', () => {
  it('passes a normal note', () => {
    expect(isSpam(makeEvent('Just had the best coffee this morning'))).toBe(false);
  });

  it('passes a note with a URL and commentary', () => {
    expect(isSpam(makeEvent('Check this out https://example.com interesting read'))).toBe(false);
  });

  it('passes a note with up to 3 URLs', () => {
    expect(isSpam(makeEvent('https://a.com https://b.com https://c.com links'))).toBe(false);
  });

  it('flags a note with 6 or more hashtag tags', () => {
    const tags = [['t','a'],['t','b'],['t','c'],['t','d'],['t','e'],['t','f']];
    expect(isSpam(makeEvent('gm frens', tags))).toBe(true);
  });

  it('passes a note with 5 hashtag tags', () => {
    const tags = [['t','a'],['t','b'],['t','c'],['t','d'],['t','e']];
    expect(isSpam(makeEvent('hello world', tags))).toBe(false);
  });

  it('flags a note with more than 3 URLs', () => {
    const content = 'https://a.com https://b.com https://c.com https://d.com';
    expect(isSpam(makeEvent(content))).toBe(true);
  });

  it('flags a link-only note (single URL, no text)', () => {
    expect(isSpam(makeEvent('https://example.com'))).toBe(true);
  });

  it('flags a link-only note with trailing whitespace', () => {
    expect(isSpam(makeEvent('  https://example.com  '))).toBe(true);
  });

  it('flags a note with only whitespace/punctuation and no URL', () => {
    expect(isSpam(makeEvent('.'))).toBe(true);
  });

  it('passes a short but meaningful note', () => {
    expect(isSpam(makeEvent('gm'))).toBe(false);
  });
});
