/** Shared Tailwind class helpers for planner forms. */
export const card = 'glass rounded-3xl border border-brand-200 dark:border-brand-900 p-5 space-y-4';
export const input =
  'rounded-xl border border-brand-200 dark:border-brand-800 bg-white/80 dark:bg-brand-950/60 px-3 py-2 text-sm text-brand-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40';
export const chip = (on: boolean) =>
  `px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
    on ? 'bg-indigo-600 text-white border-indigo-600' : 'border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-300 hover:border-indigo-400'
  }`;
