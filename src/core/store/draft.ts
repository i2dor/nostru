const KEY = 'composer_draft';

export async function getDraft(): Promise<string> {
  const result = await chrome.storage.local.get(KEY);
  return (result[KEY] as string | undefined) ?? '';
}

export async function saveDraft(text: string): Promise<void> {
  if (text) {
    await chrome.storage.local.set({ [KEY]: text });
  } else {
    await chrome.storage.local.remove(KEY);
  }
}

export async function clearDraft(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
