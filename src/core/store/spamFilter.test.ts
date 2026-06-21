import { describe, it, expect, vi, beforeEach } from 'vitest';

const store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(store, obj); }),
    },
  },
});

import { getSpamFilterEnabled, setSpamFilterEnabled } from './spamFilter';

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

describe('spamFilter store', () => {
  it('returns true by default when no setting saved', async () => {
    expect(await getSpamFilterEnabled()).toBe(true);
  });

  it('returns false after being disabled', async () => {
    await setSpamFilterEnabled(false);
    expect(await getSpamFilterEnabled()).toBe(false);
  });

  it('persists enabled state', async () => {
    await setSpamFilterEnabled(true);
    expect(await getSpamFilterEnabled()).toBe(true);
  });
});
