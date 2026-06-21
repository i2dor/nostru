const KEY = 'spam_filter_enabled';

export async function getSpamFilterEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(KEY);
  return (result[KEY] as boolean | undefined) ?? true;
}

export async function setSpamFilterEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [KEY]: enabled });
}
