import { ReactNode, KeyboardEvent, ChangeEvent } from 'react';
import { InputArea } from './InputArea';

interface WelcomeScreenProps {
  dropdowns: ReactNode;
  input: string;
  handleInput: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  loading: boolean;
  isStreaming: boolean;
  selectedAccount: string;
  selectedProvider?: string;
  thinkingEnabled?: boolean;
  setThinkingEnabled?: (enabled: boolean) => void;
  searchEnabled?: boolean;
  setSearchEnabled?: (enabled: boolean) => void;
  onFileSelect?: (files: FileList | File[] | null) => void;
  attachments?: File[];
  onRemoveAttachment?: (index: number) => void;
}

export const WelcomeScreen = ({
  dropdowns,
  input,
  handleInput,
  handleKeyDown,
  handleSend,
  loading,
  isStreaming,
  selectedAccount,
  selectedProvider,
  thinkingEnabled,
  setThinkingEnabled,
  searchEnabled,
  setSearchEnabled,
  onFileSelect,
  attachments,
  onRemoveAttachment,
}: WelcomeScreenProps) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Elara</h1>
        <p className="text-xl font-medium text-muted-foreground/80">Feel Free Chat Free!!</p>
      </div>

      <div className="w-full max-w-3xl space-y-4 text-left">
        {/* Account Selection */}
        {dropdowns}

        <InputArea
          input={input}
          handleInput={handleInput}
          handleKeyDown={handleKeyDown}
          handleSend={handleSend}
          loading={loading}
          isStreaming={isStreaming}
          selectedAccount={selectedAccount}
          selectedProvider={selectedProvider}
          thinkingEnabled={thinkingEnabled}
          setThinkingEnabled={setThinkingEnabled}
          searchEnabled={searchEnabled}
          setSearchEnabled={setSearchEnabled}
          placeholder="Ask anything..."
          className="p-0 border-none bg-transparent" // Override wrapper styles to match Welcome Screen design
          innerClassName="p-0 w-full max-w-full"
          onFileSelect={onFileSelect}
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
        />
      </div>
    </div>
  );
};
