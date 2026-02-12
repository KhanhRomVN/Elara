import { useState } from 'react';
import { GitCommit } from 'lucide-react';
import Button from '../../../shared/components/ui/button/Button';
import { toast } from 'sonner';

interface GitCommitButtonProps {
  workspacePath: string;
  onGenerateMessage: () => void;
  disabled?: boolean;
}

export const GitCommitButton = ({
  workspacePath,
  onGenerateMessage,
  disabled,
}: GitCommitButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleCommitClick = async () => {
    setLoading(true);
    try {
      // 1. Git Add .
      await window.api.git.add(workspacePath, ['.']);
      toast.success('Git Added', { description: 'Staged all changes.' });

      // 2. Trigger AI generation
      onGenerateMessage();
    } catch (error) {
      console.error('Git add failed:', error);
      toast.error('Git Error', {
        description: 'Failed to stage changes.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      icon={GitCommit}
      className="h-8 w-8 hover:bg-secondary/80 text-muted-foreground hover:text-primary transition-colors p-0 rounded-md"
      onClick={handleCommitClick}
      disabled={disabled || loading}
      loading={loading}
      title="Stage changes & Generate Commit Message"
      size={90} // Adjust size scale if needed, or rely on className overriding width/height
    />
  );
};
