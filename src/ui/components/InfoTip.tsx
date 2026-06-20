import { useRef, useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';

export function InfoTip({ text }: { text: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  };
  const hide = () => setRect(null);

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        aria-label="More info"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => rect ? hide() : show()}
        className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors shrink-0 leading-none"
      >
        <IconInfoCircle size={12} />
      </button>
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: Math.min(rect.left, window.innerWidth - 236),
            zIndex: 9999,
          }}
          className="w-56 rounded-lg bg-zinc-800 text-zinc-100 text-[11px] leading-relaxed px-3 py-2 shadow-lg pointer-events-none"
        >
          {text}
        </div>
      )}
    </span>
  );
}
