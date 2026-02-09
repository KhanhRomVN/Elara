import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  count?: number;
  loading?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Delete accounts',
  description,
  count,
  loading = false,
}: ConfirmDeleteDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-destructive/20 bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col space-y-4 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold leading-none tracking-tight text-foreground">
                  {count && count > 1 ? `Delete ${count} accounts?` : title}
                </h3>
              </div>
            </div>
            <button
              onClick={() => !loading && onOpenChange(false)}
              className="rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 disabled:pointer-events-none"
              disabled={loading}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description ||
                (count && count > 1
                  ? `Are you sure you want to permanently remove these ${count} accounts? This action cannot be undone.`
                  : 'Are you sure you want to permanently remove this account? This action cannot be undone.')}
            </p>

            <div className="rounded-lg bg-destructive/[0.03] border border-destructive/10 p-3">
              <p className="text-[11px] font-medium text-destructive/80 uppercase tracking-wider">
                Warning
              </p>
              <p className="text-xs text-destructive/70 mt-0.5">
                All associated data and stats for these accounts will be cleared from the database.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-8 transition-all shadow-sm hover:shadow-destructive/20 disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Deleting...</span>
                </div>
              ) : (
                'Delete Permanently'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
