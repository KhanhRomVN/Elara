import { FlatModel } from '../types';
import { cn } from '../../../shared/lib/utils';
import { useState } from 'react';

interface InsertSequenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetModel: FlatModel | null;
  maxSequence: number;
  onInsert: (modelId: string, providerId: string, sequence: number) => void;
}

export const InsertSequenceDialog = ({
  isOpen,
  onClose,
  targetModel,
  maxSequence,
  onInsert,
}: InsertSequenceDialogProps) => {
  const [selectedSequence, setSelectedSequence] = useState(1);

  if (!isOpen || !targetModel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-background border rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Insert Sequence</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Insert <span className="font-mono font-medium">{targetModel.model_id}</span> at position:
        </p>
        <div className="flex flex-wrap gap-2 mb-6">
          {Array.from({ length: maxSequence }, (_, i) => i + 1).map((seq) => (
            <button
              key={seq}
              onClick={() => setSelectedSequence(seq)}
              className={cn(
                'w-10 h-10 rounded-md border text-sm font-medium transition-colors',
                selectedSequence === seq
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent',
              )}
            >
              {seq}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Models at position {selectedSequence} and after will be shifted down.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onInsert(targetModel.model_id, targetModel.provider_id, selectedSequence)
            }
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
};
