import { X, Thermometer, FileText, Settings2, Loader2, Save } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { useState, useEffect } from 'react';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  temperature: number;
  setTemperature: (val: number) => void;
  isTemperatureSupported: boolean;
  contextFiles: { workspace: string; rules: string };
  isLoadingContext: boolean;
  onUpdateContextFile: (type: 'workspace' | 'rules', content: string) => Promise<void>;
  selectedWorkspacePath?: string;
}

export const SettingsSidebar = ({
  isOpen,
  onClose,
  temperature,
  setTemperature,
  isTemperatureSupported,
  contextFiles,
  isLoadingContext,
  onUpdateContextFile,
  selectedWorkspacePath,
}: SettingsSidebarProps) => {
  const [activeTab, setActiveTab] = useState<'general' | 'context'>('general');
  const [workspaceTemp, setWorkspaceTemp] = useState(contextFiles.workspace);
  const [rulesTemp, setRulesTemp] = useState(contextFiles.rules);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setWorkspaceTemp(contextFiles.workspace);
    setRulesTemp(contextFiles.rules);
  }, [contextFiles]);

  if (!isOpen) return null;

  const handleSaveContext = async (type: 'workspace' | 'rules') => {
    setIsSaving(true);
    await onUpdateContextFile(type, type === 'workspace' ? workspaceTemp : rulesTemp);
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col h-full border-l bg-card shadow-2xl shrink-0 w-[320px] animate-in slide-in-from-right duration-300 z-50">
      <div className="flex flex-col h-full gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm tracking-tight uppercase">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-full transition-colors group"
          >
            <X className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-muted/30 mx-4 mt-4 rounded-lg border">
          <button
            onClick={() => setActiveTab('general')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all',
              activeTab === 'general'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Thermometer className="w-3.5 h-3.5" />
            General
          </button>
          <button
            onClick={() => setActiveTab('context')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all',
              activeTab === 'context'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            Context
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-muted-foreground" />
                      Temperature
                    </label>
                    <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                      {temperature.toFixed(1)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      disabled={!isTemperatureSupported}
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className={cn(
                        'w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary',
                        !isTemperatureSupported && 'opacity-50 cursor-not-allowed',
                      )}
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>

                  {!isTemperatureSupported && (
                    <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <p className="text-[10px] text-amber-500 font-medium leading-relaxed">
                        This provider does not support temperature control.
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                    Higher values make output more random, lower values more deterministic.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex flex-col h-full">
              {!selectedWorkspacePath ? (
                <div className="flex flex-col items-center justify-center h-40 text-center space-y-2 opacity-60">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground px-4">
                    Please select a workspace to manage context files.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 flex flex-col flex-1">
                  {isLoadingContext ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground font-medium">
                        Loading context files...
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* workspace.md */}
                      <div className="space-y-2 flex flex-col flex-1 min-h-[200px]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            workspace.md
                          </label>
                          <button
                            onClick={() => handleSaveContext('workspace')}
                            disabled={isSaving || workspaceTemp === contextFiles.workspace}
                            className="text-[10px] flex items-center gap-1 font-bold text-primary disabled:opacity-30 uppercase"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            Save
                          </button>
                        </div>
                        <textarea
                          value={workspaceTemp}
                          onChange={(e) => setWorkspaceTemp(e.target.value)}
                          placeholder="Write project overview..."
                          className="flex-1 w-full bg-muted/20 border rounded-lg p-3 text-xs font-mono focus:ring-1 focus:ring-primary outline-none resize-none custom-scrollbar"
                        />
                      </div>

                      {/* workspace_rules.md */}
                      <div className="space-y-2 flex flex-col flex-1 min-h-[200px]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            workspace_rules.md
                          </label>
                          <button
                            onClick={() => handleSaveContext('rules')}
                            disabled={isSaving || rulesTemp === contextFiles.rules}
                            className="text-[10px] flex items-center gap-1 font-bold text-primary disabled:opacity-30 uppercase"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            Save
                          </button>
                        </div>
                        <textarea
                          value={rulesTemp}
                          onChange={(e) => setRulesTemp(e.target.value)}
                          placeholder="Write project rules..."
                          className="flex-1 w-full bg-muted/20 border rounded-lg p-3 text-xs font-mono focus:ring-1 focus:ring-primary outline-none resize-none custom-scrollbar"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto border-t p-4 bg-muted/10">
          <div className="flex items-center justify-center gap-2">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">
              Elara v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
