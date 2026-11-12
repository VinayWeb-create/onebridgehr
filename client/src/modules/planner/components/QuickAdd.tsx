import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useTaskMutations } from '../hooks';
import { errorMessage } from '../api';
import { PRIORITIES, PRIORITY_META } from '../lib/constants';
import type { TaskPriority } from '../types';
import { parseQuickAdd } from '../lib/quickAddParser';

/** Floating "+" button with an instant one-line task composer. */
export const QuickAddFab: React.FC<{ onOpenFull: (title: string) => void }> = ({ onOpenFull }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TaskPriority | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { quick } = useTaskMutations();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 50);
  }, [open]);

  // Keyboard shortcut: "n" (outside inputs) opens quick add
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const parsed = text.trim() ? parseQuickAdd(text) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    setError(null);
    try {
      await quick.mutateAsync({ title: parsed.title, dueAt: parsed.dueAt, priority: priority || parsed.priority || undefined });
      setText('');
      setPriority(null);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.06, rotate: 90 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(true)}
        className="fixed z-[60] right-5 bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-indigo-600 text-white shadow-2xl shadow-indigo-600/40 flex items-center justify-center cursor-pointer"
        aria-label="Quick add task (N)"
        title="Quick add task (N)"
      >
        <Plus size={26} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[75] bg-brand-950/40 backdrop-blur-sm flex items-end sm:items-start justify-center sm:pt-[18vh] p-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <motion.form
              onSubmit={submit}
              initial={{ y: 30, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 30, scale: 0.97, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="w-full max-w-xl rounded-3xl bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-900 shadow-2xl p-4 space-y-3"
              aria-label="Quick add task"
            >
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-indigo-500 shrink-0" />
                <input
                  ref={ref}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder='e.g. "Call Acme tomorrow 3pm !high"'
                  className="flex-1 bg-transparent text-base font-bold text-brand-950 dark:text-white placeholder:text-brand-400 focus:outline-none"
                  aria-label="Task"
                  maxLength={200}
                />
                <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900 cursor-pointer" aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {PRIORITIES.map((p) => (
                  <button key={p} type="button" onClick={() => setPriority(priority === p ? null : p)} className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase cursor-pointer ${(priority || parsed?.priority) === p ? PRIORITY_META[p].badge : 'border-brand-200 dark:border-brand-800 text-brand-400'}`}>
                    {PRIORITY_META[p].label}
                  </button>
                ))}
                {parsed?.dueAt && <span className="text-[11px] font-bold text-indigo-500">📅 {new Date(parsed.dueAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
              </div>
              {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenFull(parsed?.title || text);
                    setText('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-500 hover:text-indigo-600 cursor-pointer"
                >
                  <SlidersHorizontal size={13} /> More options
                </button>
                <button type="submit" disabled={!parsed || quick.isPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black disabled:opacity-50 cursor-pointer">
                  {quick.isPending && <Loader2 size={13} className="animate-spin" />} Add task ↵
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickAddFab;
