import NDK from '@nostr-dev-kit/ndk';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { bytesToHex } from '../keys';
import { createNDK } from './instance';

interface NDKContextValue {
  ndk: NDK | null;
  connected: boolean;
}

const Ctx = createContext<NDKContextValue>({ ndk: null, connected: false });

export function NDKProvider({ children, privkey }: { children: ReactNode; privkey: Uint8Array | null }) {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [connected, setConnected] = useState(false);
  const instanceRef = useRef<NDK | null>(null);

  useEffect(() => {
    if (!privkey) {
      instanceRef.current?.pool.relays.forEach(r => r.disconnect());
      instanceRef.current = null;
      setNdk(null);
      setConnected(false);
      return;
    }

    const instance = createNDK(bytesToHex(privkey));
    instanceRef.current = instance;
    setNdk(instance);

    instance.connect().then(() => {
      if (instanceRef.current === instance) setConnected(true);
    }).catch(() => {
      if (instanceRef.current === instance) setConnected(true);
    });

    return () => {
      instance.pool.relays.forEach(r => r.disconnect());
    };
  }, [privkey]);

  return <Ctx.Provider value={{ ndk, connected }}>{children}</Ctx.Provider>;
}

export function useNDK(): NDKContextValue {
  return useContext(Ctx);
}
