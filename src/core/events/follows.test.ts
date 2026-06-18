import { describe, it, expect } from 'vitest';
import { addToFollows, removeFromFollows } from './follows';

describe('addToFollows', () => {
  it('appends a new pubkey', () => {
    expect(addToFollows(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('returns the same array reference when already following', () => {
    const list = ['a', 'b'];
    expect(addToFollows(list, 'a')).toBe(list);
  });
});

describe('removeFromFollows', () => {
  it('removes the target pubkey', () => {
    expect(removeFromFollows(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('returns unchanged list when target is not present', () => {
    expect(removeFromFollows(['a', 'b'], 'z')).toEqual(['a', 'b']);
  });
});
