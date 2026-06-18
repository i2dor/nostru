export interface LnurlPayParams {
  callback: string;
  minSendable: number;
  maxSendable: number;
  allowsNostr: boolean;
  nostrPubkey?: string;
}

export function lud16ToUrl(lud16: string): string {
  const at = lud16.lastIndexOf('@');
  const name = lud16.slice(0, at);
  const domain = lud16.slice(at + 1);
  return `https://${domain}/.well-known/lnurlp/${name}`;
}

export function buildCallbackUrl(callback: string, amountMsats: number, zapRequest?: string): string {
  const url = new URL(callback);
  url.searchParams.set('amount', String(amountMsats));
  if (zapRequest) url.searchParams.set('nostr', zapRequest);
  return url.toString();
}

export async function resolveLud16(lud16: string): Promise<LnurlPayParams> {
  const url = lud16ToUrl(lud16);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`LNURL fetch failed: ${resp.status}`);
  const data = await resp.json() as Record<string, unknown>;
  if (data['status'] === 'ERROR') throw new Error(String(data['reason'] ?? 'LNURL error'));
  return {
    callback: data['callback'] as string,
    minSendable: data['minSendable'] as number,
    maxSendable: data['maxSendable'] as number,
    allowsNostr: Boolean(data['allowsNostr']),
    nostrPubkey: data['nostrPubkey'] as string | undefined,
  };
}

export async function fetchInvoice(callback: string, amountMsats: number, zapRequest?: string): Promise<string> {
  const url = buildCallbackUrl(callback, amountMsats, zapRequest);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Invoice fetch failed: ${resp.status}`);
  const data = await resp.json() as Record<string, unknown>;
  if (data['status'] === 'ERROR') throw new Error(String(data['reason'] ?? 'Invoice error'));
  const pr = data['pr'];
  if (typeof pr !== 'string') throw new Error('No invoice in response');
  return pr;
}
