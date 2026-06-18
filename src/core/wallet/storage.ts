const KEY = 'nwcUri';

export async function getNwcUri(): Promise<string | null> {
  const data = await chrome.storage.local.get(KEY);
  return (data[KEY] as string) ?? null;
}

export async function setNwcUri(uri: string): Promise<void> {
  await chrome.storage.local.set({ [KEY]: uri });
}

export async function clearNwcUri(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
