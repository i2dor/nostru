import { describe, it, expect, vi, beforeEach } from 'vitest';

const storageMock = (() => {
  let store: Record<string, unknown> = {};
  return {
    get: vi.fn(async (key: string) => ({ [key]: store[key] })),
    set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(store, obj); }),
    remove: vi.fn(async (key: string) => { delete store[key]; }),
    _reset: () => { store = {}; },
  };
})();

vi.stubGlobal('chrome', { storage: { local: storageMock } });

import { getDraft, saveDraft, clearDraft } from './draft';

describe('draft store', () => {
  beforeEach(() => { storageMock._reset(); vi.clearAllMocks(); });

  it('getDraft returns empty string when no draft saved', async () => {
    storageMock.get.mockResolvedValueOnce({});
    expect(await getDraft()).toBe('');
  });

  it('saveDraft persists text to storage', async () => {
    await saveDraft('hello world');
    expect(storageMock.set).toHaveBeenCalledWith({ composer_draft: 'hello world' });
  });

  it('saveDraft removes key when text is empty', async () => {
    await saveDraft('');
    expect(storageMock.remove).toHaveBeenCalledWith('composer_draft');
    expect(storageMock.set).not.toHaveBeenCalled();
  });

  it('clearDraft removes the key', async () => {
    await clearDraft();
    expect(storageMock.remove).toHaveBeenCalledWith('composer_draft');
  });

  it('getDraft returns previously saved text', async () => {
    storageMock.get.mockResolvedValueOnce({ composer_draft: 'my draft' });
    expect(await getDraft()).toBe('my draft');
  });
});
