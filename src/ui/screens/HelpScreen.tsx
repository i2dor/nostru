import { useState } from 'react';
import { IconBook, IconBolt, IconScan, IconShield, IconKey, IconGitFork } from '@tabler/icons-react';

type Section = 'start' | 'sp' | 'identity' | 'scan' | 'nwc' | 'contribute';

const SECTIONS: { id: Section; icon: typeof IconBook; label: string }[] = [
  { id: 'start',      icon: IconBook,     label: 'Getting started' },
  { id: 'sp',         icon: IconKey,      label: 'Silent Payments' },
  { id: 'identity',   icon: IconShield,   label: 'Payment identity' },
  { id: 'scan',       icon: IconScan,     label: 'Scanning' },
  { id: 'nwc',        icon: IconBolt,     label: 'NWC wallet' },
  { id: 'contribute', icon: IconGitFork,  label: 'Contribute' },
];

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-5 mb-2 first:mt-0">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{children}</li>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{children}</code>;
}

function NavLink({ label, onNavigate, target }: { label: string; onNavigate: (s: Section) => void; target: Section }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(target)}
      className="text-accent hover:underline font-medium"
    >
      {label}
    </button>
  );
}

interface SectionProps { onNavigate: (s: Section) => void }

function StartSection({ onNavigate }: SectionProps) {
  return (
    <>
      <H2>What is Nostru?</H2>
      <P>
        Nostru is a Chrome extension that combines a Nostr social client with a Bitcoin
        Silent Payment (NSP) receiver. One secp256k1 keypair is your Nostr identity and
        your Bitcoin payment address - no setup, no address exchange.
      </P>

      <H2>First steps</H2>
      <ol className="list-decimal list-inside space-y-2 mb-3">
        <Li><strong>Add your account</strong> - paste your nsec or generate a new one. Your key stays in browser session memory only and is cleared when the browser closes.</Li>
        <Li><strong>Connect a wallet (optional)</strong> - paste a NWC URI in the Wallet screen to enable one-click Lightning zaps.</Li>
        <Li><strong>Install the native host (optional)</strong> - required only for Silent Payment scanning and sweep. See the Scanning section.</Li>
        <Li><strong>Browse your feed</strong> - the outbox model fetches notes from your follows automatically.</Li>
      </ol>

      <H2>Your SP address</H2>
      <P>
        Your Silent Payment address (<Code>sp1...</Code>) appears on your own profile card
        and in the Wallet screen. You can share it with anyone - senders use any
        BIP-352-compatible wallet, they do not need Nostru.
      </P>
      <P>
        By default (Social mode), anyone who knows your npub can compute your SP address
        without asking you. To avoid this, publish a separate address using
        Deterministic or Independent mode via the Wallet screen - those addresses are
        not computable from your npub alone. See{' '}
        <NavLink label="Payment identity" onNavigate={onNavigate} target="identity" />{' '}
        for how to choose.
      </P>
    </>
  );
}

function SpSection(_: SectionProps) {
  return (
    <>
      <H2>How Silent Payments work</H2>
      <P>
        Bitcoin Silent Payments (BIP-352) let a sender pay you using only your static
        payment code. Each payment produces a unique on-chain output - no address reuse,
        no clustering, no link between two payments to the same address.
      </P>
      <P>
        Nostr keypairs use the same elliptic curve (secp256k1) as Bitcoin. Nostru derives
        your scan and spend keys from your nsec using tagged hashes, so your social
        identity becomes your Bitcoin receiver identity - no second key needed.
      </P>

      <H2>What you can do</H2>
      <ul className="list-disc list-inside space-y-1 mb-3">
        <Li>View any Nostr profile and see their derived SP address instantly</Li>
        <Li>Share your own SP address from the Wallet screen or your profile</Li>
        <Li>Scan for incoming payments locally (native host required)</Li>
        <Li>Sweep received UTXOs to any Bitcoin address</Li>
        <Li>Publish your address via NIP-352 so senders can discover it from your npub</Li>
      </ul>

      <H2>Privacy trade-offs</H2>
      <P>
        The npub-to-SP-address mapping is public and permanent. If your npub is your
        public identity, every sender can compute your SP address from your profile.
        Multiple payments to you are unlinkable on-chain, but the link between your npub
        and your SP address is not on-chain - it is at the identity layer.
      </P>
      <P>
        To separate payment identity from social identity, use Deterministic or
        Independent mode and publish via NIP-352. See the Payment identity section.
      </P>
    </>
  );
}

function IdentitySection(_: SectionProps) {
  return (
    <>
      <H2>Three modes</H2>
      <P>
        When you publish your SP address via NIP-352, you choose which key it is derived
        from. This controls the link between your social identity and your payment
        identity.
      </P>

      <H2>Social</H2>
      <P>
        Your SP address is derived directly from your Nostr public key. Anyone who knows
        your npub can compute it without querying any relay. This is the default and
        simplest option.
      </P>
      <ul className="list-disc list-inside space-y-1 mb-3">
        <Li>No extra keys to manage</Li>
        <Li>Recovery: automatic from your nsec</Li>
        <Li>Trade-off: payment address is permanently and publicly linked to your npub</Li>
      </ul>

      <H2>Deterministic (Det.)</H2>
      <P>
        Your SP address is derived from your nsec plus an index number (1, 2, 3...).
        The result is a different keypair for each index, not computable from your npub
        alone. Senders discover the address by querying your NIP-352 event on relays.
      </P>
      <ul className="list-disc list-inside space-y-1 mb-3">
        <Li>Recovery: automatic from your nsec + the index number</Li>
        <Li>Rotation: increment the index and publish a new NIP-352 event</Li>
        <Li>Trade-off: if someone knows your nsec they can derive all your payment keys</Li>
      </ul>
      <P>
        Use <strong>New identity</strong> to increment the index and get a fresh address.
        Old addresses at lower indexes remain scannable - keep track of which ones
        received funds.
      </P>

      <H2>Independent (Indep.)</H2>
      <P>
        Your SP address is derived from a completely separate keypair that has no
        mathematical relationship to your Nostr key. Generate it in the Wallet screen.
        Senders discover it via your NIP-352 event.
      </P>
      <ul className="list-disc list-inside space-y-1 mb-3">
        <Li>Maximum separation between social and payment identity</Li>
        <Li>Recovery: requires a separate backup of the payment key - back it up!</Li>
        <Li>Rotation: generate a new keypair and publish a new NIP-352 event</Li>
        <Li>Trade-off: losing the payment key means losing access to received UTXOs</Li>
      </ul>

      <H2>Which to choose</H2>
      <P>
        <strong>Social</strong> if you want simplicity and your npub is already public.
        <strong> Det.</strong> if you want a separate payment identity but recover from
        one seed. <strong>Indep.</strong> if you want maximum key separation and are
        prepared to manage two backups.
      </P>
    </>
  );
}

function ScanSection(_: SectionProps) {
  return (
    <>
      <H2>Native host setup</H2>
      <P>
        Scanning requires a local Python process (<Code>host.py</Code>) that performs
        ECDH locally. Your scan key never leaves your device.
      </P>
      <ol className="list-decimal list-inside space-y-2 mb-3">
        <Li>Clone the repo: <Code>git clone https://github.com/i2dor/nostru</Code></Li>
        <Li>Enter the tools dir: <Code>cd nostru/tools/nostru-sp</Code></Li>
        <Li>Run: <Code>python3 install.py --extension-id=YOUR_ID</Code><br />Your extension ID is shown in the Wallet screen setup wizard.</Li>
        <Li>Verify: <Code>python3 install.py --verify</Code></Li>
      </ol>

      <H2>Birthday height</H2>
      <P>
        The block height when you first used this SP address. Scanning starts from this
        height. Set it too early and the scan takes longer; set it too late and you miss
        payments. Write it down the first time you share your SP address.
      </P>
      <P>
        Use <strong>Discover from relays</strong> to auto-detect your birthday height
        from your first published NIP-352 event.
      </P>

      <H2>Scan backends</H2>
      <ul className="list-disc list-inside space-y-2 mb-3">
        <Li><strong>SP index</strong> - default. Fast. Queries a BIP-352 index server for pre-computed tweak data. The server sees your IP and scan range, not your key.</Li>
        <Li><strong>Esplora</strong> - no index needed. Fetches raw blocks locally. Limited to 20 blocks per run.</Li>
        <Li><strong>Frigate</strong> - full history over Electrum JSON-RPC. Use for large ranges or when the SP index is unavailable.</Li>
      </ul>

      <H2>After scanning</H2>
      <P>
        Found UTXOs appear in the Wallet screen. Enter a destination address and fee rate,
        then click <strong>Build sweep transaction</strong>. The local host signs entirely
        locally. You can copy the raw transaction or broadcast directly to mempool.space.
      </P>
    </>
  );
}

function NwcSection(_: SectionProps) {
  return (
    <>
      <H2>What is NWC?</H2>
      <P>
        Nostr Wallet Connect (NWC) lets Nostru communicate with a Lightning wallet using
        a Nostr-based protocol. You paste a connection URI from your wallet; Nostru uses
        it to request invoices and send zaps. Your wallet remains in control of funds.
      </P>

      <H2>Setup</H2>
      <ol className="list-decimal list-inside space-y-2 mb-3">
        <Li>Open your Lightning wallet and generate a NWC connection string (<Code>nostrwalletconnect://...</Code>).</Li>
        <Li>Open the Wallet tab in Nostru and paste the URI.</Li>
        <Li>Click <strong>Connect</strong>. Your balance appears once the wallet responds.</Li>
      </ol>

      <H2>Zapping</H2>
      <P>
        With NWC connected, a Zap button appears on profiles and notes. Enter an amount
        and optional comment - Nostru fetches the LNURL or invoice and pays via your
        wallet automatically.
      </P>

      <H2>Security</H2>
      <P>
        The NWC URI is a bearer credential. Anyone who obtains it can spend from your
        wallet up to the configured limit. Treat it like your nsec - never share it,
        screenshot it, or paste it in shared documents.
      </P>
    </>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline font-medium"
    >
      {children}
    </a>
  );
}

function ContributeSection(_: SectionProps) {
  return (
    <>
      <H2>Open source</H2>
      <P>
        Nostru is open source and free to use, study, and build on. If the idea of
        connecting Nostr identities to Bitcoin Silent Payments resonates with you,
        contributions of any kind are welcome.
      </P>
      <P>
        <ExtLink href="https://github.com/i2dor/nostru">github.com/i2dor/nostru</ExtLink>
      </P>

      <H2>Ways to get involved</H2>
      <ul className="list-disc list-inside space-y-2 mb-3">
        <Li>
          <strong>Found a bug?</strong> Open an issue on GitHub with steps to reproduce.
          The more specific, the faster it gets fixed.
        </Li>
        <Li>
          <strong>Have an idea?</strong> Open a GitHub issue tagged "enhancement". No
          idea is too small - UX friction, missing features, rough edges.
        </Li>
        <Li>
          <strong>Want to code?</strong> Fork the repo, make your change, open a PR.
          Check open issues for things already on the list.
        </Li>
        <Li>
          <strong>Know Nostr protocol?</strong> NIP-352 (kind:10352) is a draft. If
          you see gaps or improvements to the spec, open a discussion.
        </Li>
        <Li>
          <strong>Speak another language?</strong> The README has translations - adding
          or improving one is a great first contribution.
        </Li>
      </ul>

      <H2>Discuss on Nostr</H2>
      <P>
        For questions, feedback, or just to say the project exists:{' '}
        <ExtLink href="https://njump.me/npub17ph4attxued865ehp9j6dtfhpzj9az55wvur8dzq6t4y633qveuqvn9wf7">
          @nostru on Nostr
        </ExtLink>
      </P>
    </>
  );
}

const CONTENT: Record<Section, (props: SectionProps) => React.ReactElement> = {
  start:      StartSection,
  sp:         SpSection,
  identity:   IdentitySection,
  scan:       ScanSection,
  nwc:        NwcSection,
  contribute: ContributeSection,
};

export function HelpScreen() {
  const [active, setActive] = useState<Section>('start');
  const Content = CONTENT[active];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <nav className="flex overflow-x-auto shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-2 gap-0.5 py-1.5">
        {SECTIONS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-colors ${
              active === id
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Content onNavigate={setActive} />
        <p className="text-[10px] text-zinc-300 dark:text-zinc-700 mt-6">
          Nostru v{chrome.runtime.getManifest().version}
        </p>
      </div>
    </div>
  );
}
