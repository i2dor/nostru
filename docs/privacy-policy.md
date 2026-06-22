# Privacy Policy

**Nostru** is a browser extension for Chrome. This policy describes what data it accesses, where it goes, and what never leaves your device.

---

## What Nostru stores locally

| Data | Where | When cleared |
|------|-------|-------------|
| Your Nostr private key (nsec) | `chrome.storage.session` — memory only, never written to disk | When the browser closes or you sign out |
| NWC connection URI | `chrome.storage.local` — encrypted by Chrome's storage API | When you remove it or uninstall the extension |
| Relay list, mute list, block list | `chrome.storage.local` | When you remove them or uninstall |
| Silent Payment birthday height and scan results | `chrome.storage.local` | When you clear them or uninstall |

No data is written to disk by Nostru outside of Chrome's storage APIs.

---

## What Nostru never does

- **Never sends your private key over any network.** The nsec stays in session memory. The derived scan private key is passed only to the local native host process (`nostru.sp`) via Chrome Native Messaging — a private OS pipe between the extension and your local machine. It is never included in any network request.
- **No telemetry, analytics, or tracking.** Nostru contains no analytics scripts, no beacons, no crash reporters, and no third-party tracking code.
- **No background data collection.** The background service worker runs only to poll for Nostr notifications and to handle Silent Payment scan/sweep requests you initiate.
- **No advertising.** Nostru is not monetized through advertising and shares no data with advertisers.

---

## Network connections Nostru makes

Nostru connects to external services only for the features you use:

| Service | What is sent | Why |
|---------|-------------|-----|
| **Nostr relays** (user-configured) | Nostr events signed with your public key; your IP address | Publishing and reading notes, profiles, DMs |
| **LNURL / Lightning endpoints** | Invoice requests (no private key) | Resolving Lightning addresses for zaps |
| **NWC relay** (user-configured) | NIP-47 encrypted payment requests | Sending zaps via Nostr Wallet Connect |
| **Silent Payment index server** (user-configured, default: silentpayments.xyz) | Your IP address; block height range | Fetching per-block tweak data for SP scanning. **Your scan key is never sent.** |
| **mempool.space** (optional, user-initiated) | Raw signed transaction | Broadcasting a sweep transaction if you click Broadcast |

Nostru does not connect to any Nostru-operated server. There is no backend.

---

## Silent Payment native host

When you use Silent Payment scanning or sweep, Nostru launches a local Python process (`nostru.sp`) via Chrome Native Messaging. This process:

- Receives your derived scan private key via stdin
- Queries the SP index server for block tweak data (no key sent)
- Performs ECDH locally to find your UTXOs
- Returns matching UTXOs or a signed transaction via stdout
- Has no network access to your private key at any point

The native host process runs on your device only and communicates exclusively through the OS pipe Chrome Native Messaging provides. It does not start automatically — it is launched on demand when you initiate a scan or sweep.

---

## NIP-07 signing bridge

Nostru injects a `window.nostr` object into web pages you visit, allowing web applications to request event signing. Each signing request shows a permission prompt. You control which sites can sign events and can revoke permissions at any time from the extension settings. Your private key is never exposed to the web page.

---

## Children's privacy

Nostru is not directed at children under 13 and does not knowingly collect any information from children.

---

## Changes to this policy

If this policy changes materially, the update will be noted in the release changelog at https://github.com/i2dor/nostru/releases.

---

## Contact

Questions about this policy: open an issue at https://github.com/i2dor/nostru/issues or contact via Nostr at npub17ph4attxued865ehp9j6dtfhpzj9az55wvur8dzq6t4y633qveuqvn9wf7
