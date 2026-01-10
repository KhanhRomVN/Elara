import { useState, useEffect } from 'react';
import { Plus, Terminal, Trash2, Edit2, Play, AlertCircle } from 'lucide-react';
import { cn } from '../../shared/lib/utils';

interface Command {
  id: string;
  trigger: string;
  name: string;
  description: string;
  type: 'ai-completion' | 'shell';
  action: string;
}

const CommandsPage = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<Partial<Command>>({});
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    try {
      const data = await window.api.commands.getAll();
      setCommands(data);
    } catch (error) {
      console.error('Failed to load commands:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this command?')) {
      await window.api.commands.delete(id);
      loadCommands();
    }
  };

  const handleEdit = (command: Command) => {
    setCurrentCommand(command);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setCurrentCommand({
      type: 'ai-completion',
      action: '',
      description: '',
      name: '',
      trigger: '',
    });
    setIsEditing(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCommand.trigger || !currentCommand.name) return;

    try {
      if (isEditing && currentCommand.id) {
        await window.api.commands.update(currentCommand.id, currentCommand);
      } else {
        await window.api.commands.add({
          ...currentCommand,
          id: crypto.randomUUID(),
        } as Command);
      }
      setShowForm(false);
      loadCommands();
    } catch (error) {
      console.error('Failed to save command:', error);
    }
  };

  if (showForm) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? 'Edit Command' : 'New Command'}
          </h1>
          <button
            onClick={() => setShowForm(false)}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <input
                required
                className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Auto Commit"
                value={currentCommand.name || ''}
                onChange={(e) => setCurrentCommand({ ...currentCommand, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Trigger</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">elara</span>
                <input
                  required
                  className="w-full pl-14 px-3 py-2 bg-secondary/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="auto-commit"
                  value={currentCommand.trigger || ''}
                  onChange={(e) =>
                    setCurrentCommand({ ...currentCommand, trigger: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <input
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="What does this command do?"
              value={currentCommand.description || ''}
              onChange={(e) =>
                setCurrentCommand({ ...currentCommand, description: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Type</label>
            <select
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              value={currentCommand.type || 'ai-completion'}
              onChange={(e) =>
                setCurrentCommand({ ...currentCommand, type: e.target.value as any })
              }
            >
              <option value="ai-completion">AI Completion (Generative)</option>
              {/* <option value="shell">Shell Script</option> */}
            </select>
            <p className="text-xs text-muted-foreground">
              Currently only AI Completion is supported for safety.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Prompt Template</label>
            <p className="text-xs text-muted-foreground mb-2">
              Available variables: <code className="bg-muted px-1 rounded">{'{{diff}}'}</code>,{' '}
              <code className="bg-muted px-1 rounded">{'{{file_content}}'}</code>
            </p>
            <textarea
              required
              rows={8}
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-mono text-sm"
              placeholder="Generate a commit message for..."
              value={currentCommand.action || ''}
              onChange={(e) => setCurrentCommand({ ...currentCommand, action: e.target.value })}
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              Save Command
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CLI Commands</h1>
          <p className="text-muted-foreground mt-1">Manage custom commands for the Elara CLI</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Command
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {commands.map((command) => (
          <div
            key={command.id}
            className="group relative bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{command.name}</h3>
                  <code className="text-xs text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                    elara {command.trigger}
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(command)}
                  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(command.id)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">
              {command.description}
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-4 border-t border-border">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  command.type === 'ai-completion' ? 'bg-purple-500' : 'bg-blue-500',
                )}
              />
              {command.type === 'ai-completion' ? 'AI Generator' : 'Script'}
            </div>
          </div>
        ))}

        {commands.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-border rounded-lg text-muted-foreground">
            <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No commands found. Create one to get started!</p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-muted/50 rounded-lg flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How to use</p>
          <p>
            After creating a command with trigger{' '}
            <span className="font-mono text-primary">name</span>, run it in your terminal:
          </p>
          <code className="block mt-2 bg-black/20 p-2 rounded text-foreground">elara name</code>
        </div>
      </div>
    </div>
  );
};

export default CommandsPage;
