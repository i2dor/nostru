# Nostru

Nostr identity. Bitcoin Silent Payments. One key.

> _"Nostru" is the Romanian word for "ours" — your keys, your identity._

A browser extension (Chrome MV3) that connects your Nostr identity to the Bitcoin network. Read and write Nostr, zap with one click via NWC, and receive Bitcoin through Silent Payments derived from your existing keypair - all without ever leaving your browser.

---

## What it does

| Feature | Description |
|---------|-------------|
| **Social feed** | Home feed via Nostr outbox model (NDK), with replies, reactions, reposts, zaps |
| **Profiles** | View any Nostr profile, follow/unfollow, see follower counts |
| **Search** | Full-text search across notes, profiles, and long-form articles, with author + date filters |
| **Direct messages** | NIP-04 and NIP-44 encrypted messages (kind 4 / 1059) |
| **NWC wallet** | One-click Lightning zaps via Nostr Wallet Connect; balance display |
| **Block/mute lists** | NIP-51 mute list (kind 10000), published to relays; local block list |
| **NIP-07 bridge** | Acts as a web3-style Nostr signer for dApps; per-site permission system |
| **NSP addresses** | Derives a BIP-352 Silent Payment address from any Nostr public key - no consent from recipient needed |
| **NSP scanning** | Detects incoming Bitcoin Silent Payments via a local native host (no cloud key exposure) |
| **NSP sweep** | Builds and optionally broadcasts a signed sweep transaction entirely locally |
| **Notifications** | Background polling for mentions, zaps, DMs; system notifications |

---

## What it does NOT do

| What | Why |
|------|-----|
| Store private keys permanently | Keys live only in `chrome.storage.session` (cleared on browser close) |
| Send your scan key to any server | The scan private key is derived in-memory in the extension and passed only to the local native host process via Chrome Native Messaging - never over the network |
| Require an account to show NSP addresses | Any npub is enough to compute someone's Silent Payment address |
| Broadcast transactions automatically | Broadcasting is always an explicit user action with a dedicated button |
| Collect telemetry | Zero analytics, zero beacons, zero third-party scripts |
| Use cloud scanning | Scanning runs locally via `host.py` using a user-configured index server only for block data (tweaks), never for private keys |
| Expose transaction history | Silent Payment outputs are unlinkable on-chain; no xpub or address reuse |

---

## Every Nostr account is a Bitcoin Silent Payment receiver

Nostr identities are secp256k1 keypairs - the same elliptic curve that Bitcoin uses. BIP-352 (Silent Payments) is also built on secp256k1. This means the derivation is not a hack or a workaround: it is a direct mathematical consequence of shared curve arithmetic.

The derivation from any Nostr public key (`npub`) to a Silent Payment address (`sp1...`) works like this:

| Step | Operation | Who can do it |
|------|-----------|--------------|
| 1 | Take the x-only Nostr pubkey (32 bytes, even-Y per BIP-340) | Anyone |
| 2 | Compute `ScanPub = P + tagged_hash("nostr-sp/scan", P_compressed) * G` | Anyone |
| 3 | Compute `SpendPub = P + tagged_hash("nostr-sp/spend", P_compressed) * G` | Anyone |
| 4 | Encode as `sp1... = bech32m([0x00] + ScanPub_33 + SpendPub_33)` | Anyone |
| 5 | Detect incoming payments (derive `scan_priv`, scan blocks via ECDH) | nsec holder only |
| 6 | Spend received funds (derive `spend_priv + t_k`, sign sweep tx) | nsec holder only |

The key property: steps 1-4 require only the public key and are deterministic. **Anyone who can find your npub can pay you, without ever asking for an address, without you being online, and without any on-chain link between two payments to you.**

This means:

- **Every Nostr user is already a Bitcoin SP receiver,** whether or not they know it. The address exists the moment the keypair exists.
- **The Nostr social graph doubles as a Bitcoin payment directory.** If you follow someone, you can pay them silently just from their profile - without them ever sharing a Bitcoin address.
- **Payments survive key rotation workarounds.** A sender computes the address once from the npub and the resulting UTXOs are indistinguishable from any other P2TR output on-chain - no address reuse, no clustering, no linking across senders.
- **The recipient does not need to be running Nostru.** Any BIP-352-compatible wallet can send to an sp1 address derived from an npub. The recipient can scan later with Nostru whenever they choose.

Nostru makes this visible: open any profile in the extension and the `sp1...` address appears automatically, computed live in your browser from nothing more than the account's public key.

---

## Trade-offs

NSP is powerful but not neutral. These are the honest pros and cons.

**Pros**

| What you gain | Why it matters |
|---------------|---------------|
| Zero receiver setup | The SP address exists the moment the keypair exists. The receiver does not need to be online, running any software, or even aware of NSP. |
| Universal reach | Every Nostr user is already a Bitcoin receiver. No opt-in required. |
| On-chain unlinkability | Multiple payments to the same npub produce unrelated P2TR outputs. Chain analysis cannot cluster them. |
| No address reuse | Each payment produces a unique output derived via ECDH. Same recipient, different senders - outputs are indistinguishable. |
| Social graph as payment directory | Follow someone on Nostr, pay them silently - no address exchange needed. |
| No custodian, no channel | Unlike Lightning, no channel liquidity or online node required to receive. |

**Cons**

| What you give up | Why it matters |
|-----------------|---------------|
| Receiver consent | You can receive Bitcoin from anyone - including sanctioned addresses or illicit funds - without knowing. In some jurisdictions this creates legal exposure even if unintentional. Tim Bouma called this **receiver culpability**. |
| Sender deniability | If the receiver later reveals their real identity (e.g., is doxxed), the sender's payment is permanently tied to that person. The payment was private at sending time, but identity revelation retroactively links it. Tim Bouma called this **donor entrapment**. |
| No opt-out without key rotation | The npub-to-SP-address mapping is permanent. To stop being a receiver, you must rotate your npub - which breaks your social graph. |
| Scan key sensitivity | The scan private key is root-equivalent to your nsec. A compromised scan key means lifetime monitoring of all your incoming Silent Payment outputs. |
| Scanning requires local software | Nostru needs a local Python process (`host.py`) for ECDH scanning. A pure browser implementation is not possible without sending the scan key to a server. |
| Index server dependency | Scanning requires per-block tweak data from an index server. The default server sees your IP and scan range. A self-hosted alternative removes this. |
| Birthday height tracking | If you do not record the block height when you first used NSP, you may need to scan from a much earlier height - which takes longer and reveals more history to the index server. |

The core tension, as Tim Bouma described it, is that a protocol which removes friction for senders simultaneously removes agency from receivers.

---

## Why an extension and not a website

Silent Payment scanning requires access to a scan private key that is root-equivalent to your Nostr private key. A website - even one served over HTTPS or from localhost - cannot handle this safely. A browser extension can.

| Capability | Extension | Website |
|------------|-----------|---------|
| Memory-only key storage inaccessible to page scripts | `chrome.storage.session` | No equivalent; JS globals are reachable by any injected script |
| Talk to a local native process | `chrome.runtime.connectNative()` | Not available - this API is extension-only |
| Inject a NIP-07 signer into every page | Content scripts with `MAIN` world access | Would require a browser extension anyway |
| Run background tasks without a visible tab | Service worker + `chrome.alarms` | Requires a server or always-open tab |
| Sidebar alongside any web page | `chrome.sidePanel` | Impossible without an extension |
| Per-origin permission system for key access | `chrome.permissions` + custom store | No standard equivalent |

**The critical blocker for a website doing NSP is Native Messaging.** `chrome.runtime.connectNative()` is only callable from extension service workers and extension pages - not from any web origin, not even `localhost`. There is no workaround.

Without Native Messaging, a website doing NSP scanning has exactly two options:

1. **Send the scan key to a server.** The scan private key is `nsec + tagged_hash(...)` - whoever holds it can monitor every Silent Payment output addressed to you, forever. Giving it to a server converts a privacy-preserving payment protocol into a surveillance tool.

2. **Scan in the browser tab with JavaScript.** BIP-352 scanning requires secp256k1 scalar multiplication for every transaction in every block since the birthday height. At typical network throughput (thousands of transactions per block, hundreds of blocks to scan), this would take hours in a browser tab - and stop the moment the tab closes.

The extension model resolves both problems cleanly:

- The background service worker derives `scan_priv` in-memory from the session-stored `nsec`.
- It passes the key directly to the local `host.py` process via a Unix pipe (Chrome Native Messaging). The pipe is private to the OS process pair.
- `host.py` performs the ECDH computation locally, queries only the per-block tweak data (not the key) from the index server, and returns only matching UTXOs.
- The scan key is never written anywhere. If the browser closes mid-scan, it is gone.

This is only possible because the extension has `chrome.runtime.connectNative()`. A website, a PWA, and a local web app served from `file://` or `localhost` all lack this capability.

---

## Why Nostru is a first

**No browser extension has ever combined a Nostr social identity with Bitcoin Silent Payments before.**

The key innovation is the NSP (Nostr Silent Payments) protocol:

1. **One key, two networks.** Your Nostr private key (`nsec`) is an secp256k1 scalar - the same curve that Bitcoin uses. Nostru derives BIP-352 scan and spend keys from it using domain-separated tagged hashes (`nostr-sp/scan`, `nostr-sp/spend`), so your single identity key becomes your Bitcoin receiving key.

2. **Send to any Nostr user, privately.** Anyone who knows your npub can compute your Silent Payment address (`sp1...`) without asking you - and without creating a link between any two payments on-chain. A sender cannot tell if you received payment by looking at the blockchain. Neither can anyone else watching.

3. **Scan key never leaves your device.** The scan private key is root-equivalent to your nsec. Nostru handles this via Chrome Native Messaging: the background service worker derives the key in-memory and passes it directly to a local Python process (`host.py`) over a Unix pipe. The key is never written to disk, never logged, never sent over a network.

4. **No blockchain node required.** Scanning uses a lightweight index server (user-configurable) that provides pre-computed per-transaction tweaks. The local host verifies the cryptographic match and only reports UTXOs that belong to you.

5. **Full sweep without third-party signing.** The local host builds and signs the BIP-341 P2TR sweep transaction entirely in Python using zero external dependencies. The extension receives the raw transaction and lets you broadcast it or copy it for manual submission.

The combination - social discovery via Nostr + silent incoming payments + local-only signing - has never existed in a single browser extension before.

---

## Credit

The idea of mapping Nostr identities to Bitcoin Silent Payment addresses was articulated by **Tim Bouma** (GitHub: trbouma, Nostr: @trbouma). His note on receiver culpability and donor entrapment in NSP (https://gist.github.com/trbouma/77648ebe1005b181b67d1c4b42c7f31d) is the intellectual foundation of this project: it identified both the power of the mapping (every npub is already a Bitcoin receiver) and its unresolved tension (consent, culpability, entrapment). Nostru is an implementation of that idea, with a local native messaging architecture that removes the scan key exposure problem.

---

## Proposed standards

- [NIP-352](docs/nip-352.md) — *Bitcoin Silent Payment Address* — a replaceable Nostr event (kind:10352) that publishes a BIP-352 Silent Payment address discoverable via social identity, without cryptographically binding the payment address to the social keypair. Enables rotation and separation of payment identity from Nostr identity.

---

## Architecture

```
Browser (Chrome MV3)
  sidepanel.html          <- React UI
      WalletScreen        <- NWC + NSP controls
      ProfileView         <- shows derived sp1 address for any npub
  background.ts           <- service worker
      NIP-07 bridge       <- web signer for dApps
      Notification poller <- DMs, zaps, mentions
      SP handler          <- derives keys in-memory, calls native host
         |
         | Chrome Native Messaging (stdin/stdout, 4-byte LE length prefix)
         v
  host.py (local process, no network access to keys)
      identify            <- version + capability check
      scan                <- BIP-352 ECDH scan over index server tweaks
      sweep               <- BIP-341 P2TR transaction build + Schnorr sign
```

---

## Silent Payments - How to use

### Step 1 - Install the native host

The scanning and signing logic runs as a local Python script. It has zero external dependencies (pure Python 3.9+ stdlib).

```bash
git clone https://github.com/i2dor/nostru
cd nostru/tools/nostru-sp
python3 install.py --extension-id=<YOUR_EXTENSION_ID>
```

Find your extension ID at `chrome://extensions` (enable Developer mode). The Wallet screen shows it automatically in the setup wizard.

To verify the install:

```bash
python3 install.py --verify
```

To remove:

```bash
python3 install.py --uninstall
```

### Step 2 - Unlock Nostru

Sign in with your nsec. The private key lives only in session storage and is used to derive the scan and spend keys on demand.

### Step 3 - Scan for payments

Open the Wallet screen, expand "Silent Payments (NSP)", set **Birthday height**, and choose a backend:

| Backend | Field | Button |
|---------|-------|--------|
| **SP index** (default) | SP index server + optional Tip height | Scan for payments |
| **Esplora** | Esplora endpoint + Tip height (max 20 blocks) | Scan via Esplora |
| **Frigate** | Frigate server (`ssl://host:50002` or `tcp://host:50001`) | Scan via Frigate |

In all modes, the local host performs ECDH against your scan key. No private key information leaves your device. See [Scanning backends](#scanning-backends) for details on each method.

### Step 4 - Sweep

Once UTXOs are found, enter a destination Bitcoin address and a fee rate (sat/vB), then click **Build sweep transaction**. The local host:

1. Derives the per-output spend scalar (`b_spend + t_k mod n`)
2. Computes the BIP-341 sighash for each input
3. Signs with BIP-340 Schnorr using a random aux value
4. Returns the raw serialized transaction

You then either:
- **Copy raw TX** - paste into any Bitcoin broadcast tool
- **Broadcast** - sends directly to mempool.space/api/tx

---

## Receiving NSP payments (sharing your address)

Your Silent Payment address is visible on your own profile card in the extension. You can also compute anyone else's sp1 address from their npub - it appears automatically on their profile view.

Share your sp1 address the same way you share any Bitcoin address. Senders use a standard BIP-352-compatible wallet; they do not need to know about Nostr at all.

---

## Choosing a payment identity

When you publish your SP address via NIP-352, you choose how it is derived relative to your Nostr key. This controls the link between your social identity and your payment identity.

| Mode | How the SP address is derived | Recovery | Trade-off |
|------|-------------------------------|----------|-----------|
| **Social** | Directly from your Nostr public key | Automatic from nsec | Address is permanently computable from your npub by anyone |
| **Deterministic** | From your nsec + an index number (1, 2, 3...) | Automatic from nsec + index | Not computable from npub alone; scan key is still root-equivalent to nsec |
| **Independent** | From a completely separate keypair | Requires a separate backup | Maximum separation; losing the payment key loses access to received UTXOs |

**Social** is the simplest and the default. Your SP address is already public knowledge from your npub - NIP-352 just makes it explicit to clients that support the discovery protocol.

**Deterministic** gives you a payment identity that is separate from your social identity but still recoverable from your single nsec. Use "New identity" to rotate to the next index and publish a new event. Old indexes remain scannable - keep track of which ones received funds.

**Independent** gives maximum separation. Generate a dedicated payment keypair in the Wallet screen, then publish its SP address under your social npub via NIP-352. Senders discover it from your profile; the payment keypair has no mathematical link to your Nostr key. Back up the payment key separately.

The practical rule: use Social if your npub is already your public identity. Use Deterministic if you want payment rotation from a single seed. Use Independent if you are prepared to manage two key backups.

---

## Testing with a burner account

The safest way to verify the full flow (derive, receive, scan, sweep) without risking real funds or linking it to your main identity.

### What you need

- Nostru installed and the native host set up (see Step 1 above)
- A BIP-352-compatible sender wallet (Cake Wallet on mobile, or silentpayments.xyz/send for a web-based test)
- A small amount of mainnet Bitcoin to send (1000-5000 sat is enough; stay above the dust limit)

Testnet is not recommended - the NSP index at silentpayments.xyz indexes mainnet only. If you run your own index you can use signet.

### Step-by-step

**1. Generate a burner Nostr keypair**

```bash
# requires nostr-tools
npx nostr-tools@latest genkey
```

This prints an `nsec1...` and its corresponding `npub1...`. Write down the block height right now - this is your birthday height.

**2. Load the burner keypair in Nostru**

Open the extension, click "Add account", paste the `nsec`. Do NOT post anything from this account. The goal is a clean slate.

**3. Get the SP address**

Open the Wallet screen or your own profile card. The `sp1...` address appears automatically, computed from the burner npub.

**4. Send to the SP address**

From a BIP-352-compatible wallet, send to the `sp1...` address. Record:
- The sending transaction ID (txid)
- The block height it confirmed in

**5. Scan**

In the Wallet screen, set **Birthday height** to the block height from step 1. Click **Scan for payments** (uses the default SP index). If the index is unavailable, try **Scan via Esplora** or **Scan via Frigate** — see [Scanning backends](#scanning-backends).

**6. Sweep**

Enter any destination address (your main wallet, a fresh address, a faucet return address) and a fee rate, then click **Build sweep transaction**. Copy or broadcast the raw transaction.

### What a successful test proves

| Check | What it validates |
|-------|------------------|
| sp1 address derived from burner npub | deriveScanPriv / deriveSpendPub math is correct |
| Sender uses standard BIP-352 wallet | Nostru sp1 addresses are compatible with the broader ecosystem |
| Scan finds the UTXO | Native host ECDH, index server query, and key derivation all work end to end |
| Sweep broadcasts and confirms | BIP-341 P2TR signing and Schnorr signature are correct |

### Notes

- The burner keypair can be discarded after the test. Do not reuse it.
- If scan finds nothing, verify the birthday height is at or before the confirmation block, and that the native host is running (`python3 install.py --verify`). If the SP index is unavailable, try **Scan via Esplora** or **Scan via Frigate**.
- The index server sees your IP and scan range but not your private key or which UTXO is yours.

---

## Scanning backends

Three methods are available for detecting incoming Silent Payments. In all three, the scan private key stays on your device.

| Backend | Protocol | Best for |
|---------|----------|---------|
| **SP index** | REST HTTP | Default; fast; requires a BIP-352 index server |
| **Esplora** | REST HTTP | No dedicated index; fetches raw blocks locally; max 20 blocks per run |
| **Frigate** | TCP / TLS (Electrum JSON-RPC) | Full history; large ranges; requires a Frigate server |

### SP index

The default is `https://silentpayments.xyz/api`. The server returns pre-computed `input_hash × A_sum` tweak data per block; the local host does the ECDH.

**Privacy:** the index server sees your IP and scan range (birthday to tip), but not your scan key or which UTXOs are yours.

### Esplora

Fetches raw transactions from a public or self-hosted Esplora API (`https://mempool.space` by default) and computes tweaks locally. No dedicated SP index required. Limited to 20 blocks per scan to stay within API rate limits.

### Frigate

[Frigate](https://github.com/sparrowwallet/frigate) is a BIP-352-aware Electrum server. It streams `input_hash × A_sum` tweak keys over Electrum JSON-RPC; the local host performs ECDH and P2TR output matching. Your scan key is never sent to the server.

**Connection format:**
- TLS: `ssl://host:50002`
- Plain TCP: `tcp://host:50001`

To run your own Frigate server, see [github.com/sparrowwallet/frigate](https://github.com/sparrowwallet/frigate).

---

## Relay configuration

Default relays are listed in `src/core/ndk/config.ts`. You can add or remove relays from Settings. Changes take effect immediately.

---

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save accounts, relays, blocks, mutes, NWC URI |
| `sidePanel` | Open as browser sidebar or new tab |
| `nativeMessaging` | Connect to `nostru.sp` local host for Silent Payment scan/sweep |
| `notifications` | System notifications for mentions, zaps, DMs |
| `alarms` | Background polling every 5 minutes |
| `windows` | Open NIP-07 approval popup |
| `host_permissions: https://*/*` | LNURL resolution, NWC, Lightning invoice fetch |

---

## Building from source

```bash
npm install
npm run build        # production build -> dist/chrome-mv3/
npm run dev          # HMR dev mode
npm test             # vitest unit tests
```

Load `dist/chrome-mv3/` as an unpacked extension in Chrome.

---

## Security notes

- **nsec never leaves the browser.** The raw private key is stored in `chrome.storage.session` (memory only, cleared on browser close) and accessed only by the background service worker.
- **scan_priv and spend_priv are derived on demand** and passed only to the native host via stdin. They are never written to disk, never logged, never included in any network request.
- **The native host is sandboxed.** Chrome Native Messaging limits the host to communicating only with extensions that list its name in `allowed_origins`. The host binary path and the allowed extension ID are set at install time.
- **No secrets in this repository.** Setup docs use placeholders; tests use generated throwaway keys.
- **BIP-352 output unlinkability** means that even if the index server is compromised, it learns only that someone scanned a block range - not which outputs belong to you, because the ECDH step happens locally.

---

## How not to dox yourself

Silent Payments break on-chain analysis: two payments to the same npub produce unrelated outputs on-chain. But the mapping from your npub to your SP address is public, deterministic, and permanent - not on the blockchain, but at the identity layer. If your npub is your public social identity, every sender who looks up your profile already knows they are paying *you*.

These are the practical risks and what to do about each:

| Risk | What leaks | Mitigation |
|------|-----------|-----------|
| **npub is your payment identity** | Your SP address is computable from your npub by anyone. A real name, NIP-05 domain, or photo in your kind:0 profile links your Bitcoin receiving address to that identity permanently. | Publish only what you are comfortable having linked to your SP address forever. |
| **Relay IP exposure** | Every relay logs your IP alongside your npub. Multiple operators can correlate you across sessions. | Route relay traffic through Tor or a VPN before connecting. |
| **SP index server** | The index server (default: silentpayments.xyz) sees your IP and your scan range (birthday block to tip). It does not see your private key or which UTXOs are yours. | Self-host an index, or route requests through Tor. Set a custom server URL in the Wallet screen. |
| **Transaction broadcast** | The built-in broadcast sends the raw transaction to mempool.space - that endpoint sees your IP and the transaction. | Use your own Bitcoin node, or copy the raw TX and submit it through Tor via a separate tool. |
| **NWC URI** | Your `nostrwalletconnect://` URI is a bearer credential. Anyone who gets it can drain your wallet up to the configured spend limit. | Never post it, screenshot it, or paste it in a shared document. Treat it with the same care as your nsec. |
| **Kind:0 metadata is permanent** | Name, picture, NIP-05, and bio are published to relays and permanently tied to your npub - and therefore to your SP address. | Audit your profile before sharing your sp1 address publicly. |

**Separation of identities**

For higher privacy, use a dedicated keypair for payments:

1. Generate a second keypair (`nsec2`) that you never attach to a public profile and never use for social notes.
2. Derive its SP address and share only that with specific senders.
3. Use Nostru with `nsec2` solely for scanning and sweeping.

The SP address derived from `nsec2` is completely separate from your social npub. Senders need the payment npub or the sp1 address directly - they cannot find it from your public profile.

**What you cannot undo**

The npub-to-SP-address mapping is deterministic and permanent. If you have already published your npub widely, every sender can already compute your SP address and will be able to do so permanently. There is no rotation mechanism short of rotating the npub itself.

---

## Contact

Nostr: [npub17ph4attxued865ehp9j6dtfhpzj9az55wvur8dzq6t4y633qveuqvn9wf7](https://njump.me/npub17ph4attxued865ehp9j6dtfhpzj9az55wvur8dzq6t4y633qveuqvn9wf7)
