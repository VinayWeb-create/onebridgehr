import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowMenuItem {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/** Compact "more actions" dropdown for table rows. */
export const RowMenu: React.FC<{ items: RowMenuItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const closeNow = () => setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', closeNow, true);
    window.addEventListener('resize', closeNow);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', closeNow, true);
      window.removeEventListener('resize', closeNow);
    };
  }, [open]);

  // Fixed positioning so the menu isn't clipped by the table's scroll container.
  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.max(8, rect.right - 208);
      const openUp = rect.bottom + 300 > window.innerHeight;
      setPos(openUp ? { left, bottom: window.innerHeight - rect.top + 4 } : { left, top: rect.bottom + 4 });
    }
    setOpen((o) => !o);
  };

  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded text-slate-500"
        title="More actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div style={pos} className="fixed z-50 w-52 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg shadow-lg py-1 text-left">
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-brand-800 ${
                item.danger ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {item.icon && <item.icon className="w-4 h-4 shrink-0" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RowMenu;
