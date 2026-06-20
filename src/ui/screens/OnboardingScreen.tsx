import { useState } from 'react';
import { IconKey, IconPlus, IconDownload, IconEye, IconEyeOff, IconMessage2, IconBolt, IconAt } from '@tabler/icons-react';
import { useAccount } from '../context/AccountContext';
import { encodePubkey, generateKeypair, encodePrivkey } from '../../core/keys';

type Step = 'welcome' | 'setup';
type Tab = 'create' | 'import';
type CreateStep = 'preview' | 'password';

const FEATURES = [
  { icon: IconAt, text: 'Claim your own name@nostru.net identity' },
  { icon: IconMessage2, text: 'Post, follow people, reply - no algorithms' },
  { icon: IconBolt, text: 'Zap anyone with Bitcoin, instantly' },
  { icon: IconKey, text: 'Your key, your account - no one can take it away' },
] as const;

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col h-full items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold tracking-tight text-accent dark:text-accent-light">Nostru</div>
          <p className="text-sm text-zinc-500 leading-relaxed">
            A Nostr client where you own your identity.<br />
            No server can ban you. No company can delete you.
          </p>
        </div>

        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-accent/10 dark:bg-accent-light/10 flex items-center justify-center">
                <Icon size={15} className="text-accent dark:text-accent-light" />
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-300 leading-snug">{text}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onContinue}
          className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Get started
        </button>
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-500">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
      </div>
    </div>
  );
}

function CreateTab() {
  const { createAccount } = useAccount();
  const [step, setStep] = useState<CreateStep>('preview');
  const [preview] = useState(() => {
    const { privkey, pubkey } = generateKeypair();
    return { privkey, pubkey, nsec: encodePrivkey(privkey), npub: encodePubkey(pubkey) };
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError('');
    setBusy(true);
    try {
      await createAccount(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
      setBusy(false);
    }
  }

  if (step === 'preview') {
    return (
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">A new keypair has been generated. Save your secret key before continuing.</p>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Public key (npub)</span>
            <p className="font-mono text-xs break-all mt-0.5 text-zinc-700 dark:text-zinc-300">{preview.npub}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Secret key (nsec) - keep private</span>
            <p className="font-mono text-xs break-all mt-0.5 text-red-500 select-all">{preview.nsec}</p>
          </div>
        </div>
        <button
          onClick={() => setStep('password')}
          className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          I saved my key - continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="Min. 8 characters" />
      <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Encrypting key...' : 'Create account'}
      </button>
    </div>
  );
}

function ImportTab() {
  const { importKey } = useAccount();
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isNcryptsec = input.trim().startsWith('ncryptsec1');

  async function handleImport() {
    if (!input.trim()) { setError('Paste your nsec, hex key, or ncryptsec'); return; }
    if (!isNcryptsec) {
      if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
      if (password !== confirm) { setError('Passwords do not match'); return; }
    } else {
      if (!password) { setError('Enter your ncryptsec password to verify it'); return; }
    }
    setError('');
    setBusy(true);
    try {
      await importKey(input, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed - check your key and password');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-zinc-500">Secret key</label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="nsec1... or ncryptsec1... or 64-char hex"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-xs font-mono outline-none focus:ring-2 focus:ring-accent/40 resize-none"
        />
      </div>
      <PasswordInput
        label={isNcryptsec ? 'ncryptsec password' : 'New password'}
        value={password}
        onChange={setPassword}
        placeholder={isNcryptsec ? 'Password to decrypt' : 'Min. 8 characters'}
      />
      {!isNcryptsec && (
        <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleImport}
        disabled={busy}
        className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Importing...' : 'Import account'}
      </button>
    </div>
  );
}

function SetupStep() {
  const [tab, setTab] = useState<Tab>('create');

  return (
    <div className="flex flex-col h-full items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <IconKey size={32} className="text-accent" />
          </div>
          <h1 className="text-lg font-medium">Set up your identity</h1>
          <p className="text-xs text-zinc-500">Create a new key or import an existing one</p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 gap-0.5">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === 'create' ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <IconPlus size={14} /> New account
          </button>
          <button
            onClick={() => setTab('import')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === 'import' ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <IconDownload size={14} /> Import key
          </button>
        </div>
        {tab === 'create' ? <CreateTab /> : <ImportTab />}
      </div>
    </div>
  );
}

export function OnboardingScreen() {
  const [step, setStep] = useState<Step>('welcome');

  if (step === 'welcome') return <WelcomeStep onContinue={() => setStep('setup')} />;
  return <SetupStep />;
}
