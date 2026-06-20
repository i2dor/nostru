import { useRef, useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';

interface InfoTipProps {
  text: string;
  /** 'right' (default) opens to the right; 'left' opens to the left */
  side?: 'right' | 'left';
}

export function InfoTip({ text, side = 'right' }: InfoTipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={ref}
        type="button"
        aria-label="More info"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors shrink-0 leading-none"
      >
        <IconInfoCircle size={12} />
      </button>
      {visible && (
        <div
          className={`absolute z-50 w-56 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-zinc-100 text-[11px] leading-relaxed px-3 py-2 shadow-lg pointer-events-none ${
            side === 'left'
              ? 'right-full mr-2 top-1/2 -translate-y-1/2'
              : 'left-full ml-2 top-1/2 -translate-y-1/2'
          }`}
        >
          {text}
        </div>
      )}
    </span>
  );
}
