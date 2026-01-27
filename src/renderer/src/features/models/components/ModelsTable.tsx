import { MoreHorizontal, Plus, ArrowDownUp, Trash2, Check, X } from 'lucide-react';
import { Favicon } from '../../../shared/utils/faviconUtils';
import { cn } from '../../../shared/lib/utils';
import { FlatModel, SortKey, SortDirection } from '../types';
import {
  getSuccessRateClass,
  getSequenceClass,
  getMaxReqClass,
  getMaxTokenClass,
  getSortColorClass,
} from '../utils/modelUtils';
import { useState } from 'react';

interface ModelsTableProps {
  models: FlatModel[];
  startIndex: number;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  getModelSequence: (modelId: string, providerId: string) => number | undefined;
  maxSequence: number;
  onSetNext: (model: FlatModel) => void;
  onOpenInsert: (model: FlatModel) => void;
  onRemove: (model: FlatModel) => void;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

export const ModelsTable = ({
  models,
  startIndex,
  sortKey,
  sortDirection,
  onSort,
  getModelSequence,
  maxSequence,
  onSetNext,
  onOpenInsert,
  onRemove,
}: ModelsTableProps) => {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  return (
    <div className="w-full overflow-auto flex-1">
      <table className="w-full caption-bottom text-sm text-left">
        <thead className="sticky top-0 bg-card z-10 border-b">
          <tr className="border-b transition-colors hover:bg-muted/50">
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[60px] text-center">
              STT
            </th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Model</th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[80px] text-center">
              Thinking
            </th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[80px] text-center">
              Context
            </th>
            <th
              className={cn(
                'h-12 px-4 align-middle font-medium cursor-pointer text-center select-none transition-colors',
                getSortColorClass('success_rate', sortKey, sortDirection),
              )}
              onClick={() => onSort('success_rate')}
            >
              Success Rate
            </th>
            <th
              className={cn(
                'h-12 px-4 align-middle font-medium cursor-pointer text-center select-none transition-colors whitespace-nowrap',
                getSortColorClass('max_req_conversation', sortKey, sortDirection),
              )}
              onClick={() => onSort('max_req_conversation')}
            >
              Max Load (Req | Token)
            </th>
            <th
              className={cn(
                'h-12 px-4 align-middle font-medium cursor-pointer text-center select-none transition-colors whitespace-nowrap',
                getSortColorClass('usage_requests', sortKey, sortDirection),
              )}
              onClick={() => onSort('usage_requests')}
            >
              Totals (Req | Token)
            </th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[100px] text-center">
              Sequence
            </th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[100px] text-center">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {models.length === 0 && (
            <tr>
              <td colSpan={9} className="h-24 text-center text-muted-foreground">
                No models available.
              </td>
            </tr>
          )}
          {models.map((model, index) => {
            const sequence = getModelSequence(model.model_id, model.provider_id);
            const absoluteIndex = startIndex + index + 1;
            const hasSequence = sequence !== undefined;
            const uniqueKey = `${model.provider_id}-${model.model_id}`;

            return (
              <tr
                key={uniqueKey}
                className={cn(
                  'border-b transition-colors hover:bg-muted/50',
                  hasSequence && 'bg-primary/5',
                )}
              >
                <td className="px-4 py-1.5 align-middle text-muted-foreground text-center">
                  {absoluteIndex}
                </td>
                <td className="px-4 py-1.5 align-middle">
                  <div className="flex items-center gap-2 truncate flex-1">
                    <div className="w-32 shrink-0 flex items-center justify-end gap-1.5">
                      <Favicon url={model.website} size={14} className="rounded-sm opacity-70" />
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0 lowercase">
                        {model.provider_id}
                      </span>
                    </div>
                    <span className="text-zinc-700 font-light shrink-0">|</span>
                    <span className="truncate flex-1 font-medium">{model.model_id}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  {model.is_thinking ? (
                    <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  <span className="text-xs font-mono text-muted-foreground">
                    {model.context_length ? formatNumber(model.context_length) : '-'}
                  </span>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      getSuccessRateClass(model.success_rate || 0),
                    )}
                  >
                    {model.success_rate || 0}%
                  </span>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        getMaxReqClass(model.max_req_conversation || 0),
                      )}
                    >
                      {model.max_req_conversation || 0}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-40">|</span>
                    <span
                      className={cn(
                        'text-[11px] font-mono',
                        getMaxTokenClass(model.max_token_conversation || 0),
                      )}
                    >
                      {formatNumber(model.max_token_conversation || 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {formatNumber(model.usage_requests || 0)}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-40">|</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatNumber(model.usage_tokens || 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  {hasSequence ? (
                    <span
                      className={cn('text-sm font-bold', getSequenceClass(sequence, maxSequence))}
                    >
                      {sequence}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  <div className="relative inline-block">
                    <button
                      onClick={() =>
                        setActiveDropdownId(activeDropdownId === uniqueKey ? null : uniqueKey)
                      }
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {activeDropdownId === uniqueKey && (
                      <div className="absolute right-0 top-full mt-1 w-56 rounded-md border bg-popover text-popover-foreground shadow-md z-50">
                        <div className="p-1">
                          {!hasSequence && (
                            <button
                              onClick={() => {
                                onSetNext(model);
                                setActiveDropdownId(null);
                              }}
                              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Set as sequence {maxSequence + 1}
                            </button>
                          )}
                          {!hasSequence && maxSequence > 0 && (
                            <button
                              onClick={() => {
                                onOpenInsert(model);
                                setActiveDropdownId(null);
                              }}
                              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              <ArrowDownUp className="mr-2 h-4 w-4" />
                              Insert at sequence...
                            </button>
                          )}
                          {hasSequence && (
                            <button
                              onClick={() => {
                                onRemove(model);
                                setActiveDropdownId(null);
                              }}
                              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-destructive/10 hover:text-destructive text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove sequence
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
