import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { getNwcUri, setNwcUri, clearNwcUri } from '../../core/wallet/storage';
import { NwcClient, parseNwcUri } from '../../core/wallet/nwc';

interface WalletContextValue {
  nwcUri: string | null;
  balance: number | null; // sats
  isConnected: boolean;
  connect: (uri: string) => Promise<void>;
  disconnect: () => Promise<void>;
  payInvoice: (bolt11: string) => Promise<string>; // returns preimage
}

const Ctx = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [nwcUri, setNwcUriState] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const clientRef = useRef<NwcClient | null>(null);

  async function initClient(uri: string) {
    const info = parseNwcUri(uri);
    const client = new NwcClient(info);
    await client.connect();
    clientRef.current = client;
    try {
      const bal = await client.getBalance();
      setBalance(bal);
    } catch {
      setBalance(null);
    }
  }

  useEffect(() => {
    getNwcUri().then(uri => {
      if (!uri) return;
      setNwcUriState(uri);
      initClient(uri).catch(() => {});
    });
  }, []);

  // Refresh balance every 60 seconds when connected
  useEffect(() => {
    if (!clientRef.current) return;
    const id = setInterval(async () => {
      try {
        const bal = await clientRef.current!.getBalance();
        setBalance(bal);
      } catch {}
    }, 60_000);
    return () => clearInterval(id);
  }, [nwcUri]);

  const connect = useCallback(async (uri: string) => {
    await setNwcUri(uri);
    setNwcUriState(uri);
    await initClient(uri);
  }, []);

  const disconnect = useCallback(async () => {
    await clearNwcUri();
    clientRef.current?.disconnect();
    clientRef.current = null;
    setNwcUriState(null);
    setBalance(null);
  }, []);

  const payInvoice = useCallback(async (bolt11: string) => {
    if (!clientRef.current) throw new Error('Wallet not connected');
    return clientRef.current.payInvoice(bolt11);
  }, []);

  return (
    <Ctx.Provider value={{ nwcUri, balance, isConnected: !!clientRef.current, connect, disconnect, payInvoice }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
