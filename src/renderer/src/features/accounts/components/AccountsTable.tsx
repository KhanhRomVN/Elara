import { Copy, MousePointer2, Trash2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../shared/lib/utils';
import { FlatAccount } from '../types';
import { getSuccessRateClass } from '../../models/utils/modelUtils';

interface AccountsTableProps {
  accounts: FlatAccount[];
  loading: boolean;
  selectedAccounts: Set<string>;
  toggleSelection: (id: string) => void;
  toggleAll: () => void;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  providerConfigs: any[];
  onDelete: (id: string, email?: string) => void;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

export const AccountsTable = ({
  accounts,
  loading,
  selectedAccounts,
  toggleSelection,
  toggleAll,
  allVisibleSelected,
  someVisibleSelected,
  providerConfigs,
  onDelete,
}: AccountsTableProps) => {
  const navigate = useNavigate();

  const copyAccountJson = (account: FlatAccount) => {
    navigator.clipboard.writeText(JSON.stringify(account, null, 2));
  };

  return (
    <div className="w-full overflow-auto">
      <table className="w-full caption-bottom text-sm text-left border-collapse">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="border-b transition-colors hover:bg-muted/50">
            <th className="h-12 px-4 align-middle w-[40px] text-center">
              <div
                className={cn(
                  'w-4 h-4 rounded border border-zinc-600 flex items-center justify-center cursor-pointer transition-all',
                  allVisibleSelected ? 'bg-primary border-primary' : 'bg-zinc-900/50',
                  !allVisibleSelected && someVisibleSelected && 'bg-primary/50 border-primary/50',
                )}
                onClick={toggleAll}
              >
                {allVisibleSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                {!allVisibleSelected && someVisibleSelected && (
                  <div className="w-2 h-0.5 bg-white rounded-full" />
                )}
              </div>
            </th>
            <th className="h-12 px-4 align-middle w-[50px] text-center">STT</th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground whitespace-nowrap text-left">
              Account
            </th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-center">
              Success Rate
            </th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-center whitespace-nowrap">
              Max Load (Req | Token)
            </th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-center whitespace-nowrap">
              Totals (Req | Token)
            </th>
            <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right w-[100px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {accounts.length === 0 && !loading && (
            <tr>
              <td colSpan={7} className="h-24 text-center text-muted-foreground">
                No accounts found.
              </td>
            </tr>
          )}
          {accounts.map((account, index) => {
            const isActive = account.isActive;
            const isSelected = selectedAccounts.has(account.id);
            const successRate = account.total_requests
              ? Math.round(((account.successful_requests || 0) / account.total_requests) * 100)
              : 0;

            return (
              <tr
                key={account.id}
                className={cn(
                  'border-b transition-all hover:bg-muted/50 relative group',
                  isSelected &&
                    'bg-primary/[0.03] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[3px] after:bg-primary',
                  !isActive && 'opacity-50 grayscale',
                )}
              >
                <td className="px-4 py-1.5 align-middle text-center">
                  <div
                    className={cn(
                      'w-4 h-4 rounded border border-zinc-600 flex items-center justify-center cursor-pointer transition-all mx-auto',
                      isSelected ? 'bg-primary border-primary' : 'bg-zinc-900/50',
                    )}
                    onClick={() => toggleSelection(account.id)}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </div>
                </td>
                <td className="px-4 py-1.5 align-middle text-muted-foreground text-center text-xs">
                  {index + 1}
                </td>
                <td className="px-4 py-1.5 align-middle text-left">
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center p-0.5 bg-secondary/30">
                        {providerConfigs.find(
                          (p) => p.provider_id.toLowerCase() === account.provider_id.toLowerCase(),
                        )?.icon ? (
                          <img
                            src={
                              providerConfigs.find(
                                (p) =>
                                  p.provider_id.toLowerCase() === account.provider_id.toLowerCase(),
                              )?.icon
                            }
                            alt={account.provider_id}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[8px] uppercase font-bold">
                            {account.provider_id.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono lowercase opacity-70">
                        {account.provider_id}
                      </span>
                    </div>
                    <span className="text-zinc-700 font-light shrink-0">|</span>
                    <span className="font-medium text-sm truncate">{account.email}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  <span className={cn('text-sm font-medium', getSuccessRateClass(successRate))}>
                    {account.total_requests ? `${successRate}%` : '-'}
                  </span>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {account.max_req_conversation || 0}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-40">|</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatNumber(account.max_token_conversation || 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {formatNumber(account.total_requests || 0)}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-40">|</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatNumber(account.total_tokens || 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-1.5 align-middle text-right">
                  <div className="flex justify-end gap-2 text-right">
                    <button
                      onClick={() => copyAccountJson(account)}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8"
                      title="Copy JSON"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        navigate('/playground', {
                          state: { providerId: account.provider_id, accountId: account.id },
                        });
                      }}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8"
                      title="Open in Playground"
                    >
                      <MousePointer2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(account.id, account.email)}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-destructive/10 text-destructive h-8 w-8 text-right"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
