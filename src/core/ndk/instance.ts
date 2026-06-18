import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from './config';

export function createNDK(privkeyHex: string): NDK {
  const signer = new NDKPrivateKeySigner(privkeyHex);
  return new NDK({
    explicitRelayUrls: [...DEFAULT_RELAYS],
    signer,
    enableOutboxModel: true,
  });
}
