# Chrome Web Store Listing

## Name
Nostru

## Summary (132 chars max — current: 80)
Nostr social client and Bitcoin Silent Payment receiver. One keypair, two networks.

## Category
Social & Communication

## Language
English

---

## Description (paste as plain text into the store form)

Nostru is a Nostr social client and Bitcoin Silent Payment receiver that runs entirely in your browser sidebar. One secp256k1 keypair is your Nostr identity and your Bitcoin receiving address — no second key, no setup, no address exchange.

★ NOSTR SOCIAL CLIENT

• Home feed built on the outbox model (NIP-65) — follows your contacts across the relays they actually use
• Profiles, threads, replies, reactions, reposts, and zaps
• Direct messages (NIP-04 and NIP-44 encrypted)
• Search across notes, profiles, and long-form articles
• Mute and block lists synced to your relays (NIP-51)
• Notifications for mentions, zaps, and DMs in the background

★ BITCOIN SILENT PAYMENTS

Silent Payments (BIP-352) let a sender pay you using only a static address, with no address reuse and no on-chain link between payments. Nostru connects your Nostr identity to this protocol:

• View any Nostr profile and see their Bitcoin Silent Payment address instantly — computed live from their public key, no relay query needed
• Share your own sp1... address from your profile or the Wallet screen
• Publish your address via NIP-352 (kind:30352) so wallets can discover it from your profile
• Choose how your address is derived: from your social key (simplest), from a sub-key (rotatable, not computable from your npub), or from an independent keypair (maximum separation)
• Scan for incoming payments locally — your scan key never leaves your device
• Build and sign sweep transactions entirely on your machine via the local native host

★ NWC WALLET

• Connect any Nostr Wallet Connect (NWC) compatible Lightning wallet
• One-click zaps on profiles and notes
• Balance display

★ NIP-07 SIGNER

• Injects window.nostr into web pages so Nostr web apps can request signatures
• Per-site permission system — you control which sites can sign
• Your private key is never exposed to the web page

★ PRIVACY BY DESIGN

• Your private key lives only in session memory — cleared automatically when the browser closes
• No telemetry, no analytics, no third-party scripts
• Scan key passed only to a local process via Chrome Native Messaging — never sent over any network
• No Nostru-operated server; connects only to Nostr relays, your NWC relay, and user-configured index servers

★ SILENT PAYMENT SCANNING (requires local setup)

Scanning for incoming Silent Payments requires a small local Python script (nostru-sp). It runs on your machine, performs the cryptographic matching locally, and communicates with the extension via Chrome Native Messaging. Setup instructions: https://github.com/i2dor/nostru

---

## Privacy policy URL
https://github.com/i2dor/nostru/blob/main/docs/privacy-policy.md

## Homepage URL
https://github.com/i2dor/nostru

## Support URL
https://github.com/i2dor/nostru/issues

---

## Screenshots needed (1280×800 or 640×400, minimum 1, maximum 5)

Suggested shots:
1. Feed — home timeline with notes, avatars, reactions visible
2. Profile — a profile card showing the sp1... Silent Payment address
3. Wallet screen — NWC balance + Silent Payment section
4. Thread view — a note with replies expanded
5. Search results — search for a term showing mixed note/profile results

## Promotional tile (440×280, optional but recommended)
Text: "Nostru — Nostr + Bitcoin Silent Payments"
Background: indigo gradient matching the icon
