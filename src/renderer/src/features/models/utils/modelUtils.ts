import { cn } from '../../../shared/lib/utils';
import { SortKey, SortDirection } from '../types';

// Metric Color Helpers
export const getSuccessRateClass = (rate: number) => {
  if (rate >= 95) return 'text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]';
  if (rate >= 80) return 'text-emerald-500/80';
  if (rate >= 50) return 'text-amber-500/80';
  if (rate > 0) return 'text-red-500/70';
  return 'text-muted-foreground/50';
};

export const getSequenceClass = (seq: number, maxSeq: number) => {
  if (maxSeq <= 1) return 'text-primary';
  const intensity = seq / maxSeq;
  if (intensity >= 0.8)
    return 'text-primary font-bold drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]';
  if (intensity >= 0.5) return 'text-primary/90 font-semibold';
  if (intensity >= 0.2) return 'text-primary/70';
  return 'text-primary/50';
};

export const getMaxReqClass = (val: number) => {
  if (val >= 100) return 'text-blue-400 font-bold';
  if (val >= 50) return 'text-blue-500/80';
  if (val >= 20) return 'text-zinc-300';
  if (val > 0) return 'text-zinc-500';
  return 'text-muted-foreground/50';
};

export const getMaxTokenClass = (val: number) => {
  if (val >= 128000) return 'text-purple-400 font-bold drop-shadow-[0_0_8px_rgba(192,132,252,0.3)]';
  if (val >= 32000) return 'text-purple-500/80';
  if (val >= 8000) return 'text-zinc-300';
  if (val > 0) return 'text-zinc-500';
  return 'text-muted-foreground/50';
};

export const getSortColorClass = (key: SortKey, currentKey: SortKey, direction: SortDirection) => {
  if (currentKey !== key || direction === 'none')
    return 'text-muted-foreground hover:text-foreground';
  if (direction === 'asc') return 'text-green-500 hover:text-green-600';
  return 'text-red-500 hover:text-red-600';
};
