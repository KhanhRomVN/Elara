import { Switch } from '../../../core/components/Switch';
import { cn } from '../../../shared/lib/utils';
import { Plus, X, Trash2 } from 'lucide-react';

interface GroqSettings {
  temperature: number;
  maxTokens: number;
  reasoning: 'none' | 'low' | 'medium' | 'high';
  stream: boolean;
  jsonMode: boolean;
  tools: {
    browserSearch: boolean;
    codeInterpreter: boolean;
  };
  customFunctions: FunctionParams[];
}

export interface FunctionParams {
  name: string;
  description: string;
  parameters: string; // JSON string
}

interface GroqSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GroqSettings;
  onSettingsChange: (settings: GroqSettings) => void;
}

export const GroqSettingsDrawer = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: GroqSettingsDrawerProps) => {
  const updateSetting = <K extends keyof GroqSettings>(key: K, value: GroqSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const toggleTool = (tool: keyof GroqSettings['tools']) => {
    updateSetting('tools', { ...settings.tools, [tool]: !settings.tools[tool] });
  };

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 w-80 bg-background border-l shadow-lg transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-lg">PARAMETERS</h2>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Temperature</label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={settings.temperature}
              onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
              className="w-16 p-1 text-right text-sm bg-muted rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={settings.temperature}
            onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Max Completion Tokens</label>
            <input
              type="number"
              min={1}
              max={32768}
              step={1}
              value={settings.maxTokens}
              onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
              className="w-20 p-1 text-right text-sm bg-muted rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <input
            type="range"
            min={1}
            max={32768}
            step={1}
            value={settings.maxTokens}
            onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Reasoning */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Reasoning</label>
          <select
            value={settings.reasoning}
            onChange={(e) =>
              updateSetting('reasoning', e.target.value as GroqSettings['reasoning'])
            }
            className="w-full p-2 text-sm bg-muted rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Toggles */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Stream</label>
            <Switch checked={settings.stream} onCheckedChange={(v) => updateSetting('stream', v)} />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">JSON Mode</label>
            <Switch
              checked={settings.jsonMode}
              onCheckedChange={(v) => updateSetting('jsonMode', v)}
            />
          </div>
        </div>

        <hr className="border-border" />

        {/* Built-in Tools */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-muted-foreground">Built-in tools</label>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Browser Search</label>
            <Switch
              checked={settings.tools.browserSearch}
              onCheckedChange={() => toggleTool('browserSearch')}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Code Interpreter</label>
            <Switch
              checked={settings.tools.codeInterpreter}
              onCheckedChange={() => toggleTool('codeInterpreter')}
            />
          </div>
        </div>

        <hr className="border-border" />

        {/* Custom Functions */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-muted-foreground">Custom function tools</label>

          {settings.customFunctions.map((func, index) => (
            <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-2 relative group">
              <button
                onClick={() => {
                  const newFuncs = settings.customFunctions.filter((_, i) => i !== index);
                  updateSetting('customFunctions', newFuncs);
                }}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid gap-2">
                <input
                  placeholder="Function Name"
                  value={func.name}
                  onChange={(e) => {
                    const newFuncs = [...settings.customFunctions];
                    newFuncs[index].name = e.target.value;
                    updateSetting('customFunctions', newFuncs);
                  }}
                  className="text-sm p-1 rounded bg-background border border-input w-full font-mono"
                />
                <input
                  placeholder="Description"
                  value={func.description}
                  onChange={(e) => {
                    const newFuncs = [...settings.customFunctions];
                    newFuncs[index].description = e.target.value;
                    updateSetting('customFunctions', newFuncs);
                  }}
                  className="text-sm p-1 rounded bg-background border border-input w-full"
                />
                <textarea
                  placeholder='Parameters JSON (e.g. {"type": "object", ...})'
                  value={func.parameters}
                  onChange={(e) => {
                    const newFuncs = [...settings.customFunctions];
                    newFuncs[index].parameters = e.target.value;
                    updateSetting('customFunctions', newFuncs);
                  }}
                  className="text-xs p-2 rounded bg-background border border-input w-full font-mono h-20"
                />
              </div>
            </div>
          ))}

          <button
            onClick={() =>
              updateSetting('customFunctions', [
                ...settings.customFunctions,
                { name: '', description: '', parameters: '{}' },
              ])
            }
            className="flex items-center justify-center gap-2 w-full p-2 border border-dashed rounded-lg hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Function
          </button>
        </div>
      </div>
    </div>
  );
};
