import { useState, useEffect } from 'react';
import {
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Database,
  Key,
  Server,
  Check,
  FolderSearch,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../shared/lib/utils';

interface QdrantConfig {
  id: string;
  email?: string;
  cluster_name?: string;
  cluster_api_key: string;
  cluster_endpoint: string;
}

interface GeminiKeyConfig {
  id: string;
  email: string;
  api_key: string;
}

interface SettingsConfig {
  rag_enabled: boolean;
  qdrant_databases: QdrantConfig[];
  gemini_api_keys: GeminiKeyConfig[];
  rerank_enabled: boolean;
}

type SidebarOption = 'indexing' | 'general';

const SettingsPage = () => {
  const [config, setConfig] = useState<SettingsConfig>({
    rag_enabled: true,
    qdrant_databases: [],
    gemini_api_keys: [],
    rerank_enabled: true, // Always enabled
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [showGeminiKeys, setShowGeminiKeys] = useState<Record<string, boolean>>({});
  const [editingQdrant, setEditingQdrant] = useState<QdrantConfig | null>(null);
  const [showQdrantForm, setShowQdrantForm] = useState(false);
  const [editingGemini, setEditingGemini] = useState<GeminiKeyConfig | null>(null);
  const [showGeminiForm, setShowGeminiForm] = useState(false);
  const [activeSection, setActiveSection] = useState<SidebarOption>('general');
  const [generalConfig, setGeneralConfig] = useState({
    apiUrl: localStorage.getItem('ELARA_API_URL') || 'http://localhost:11434',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const serverStatus = await window.api.server.start();
      const port = serverStatus.port || 11434;

      const response = await fetch(`http://localhost:${port}/v1/config/rag`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Convert old format to new format if needed
          const qdrantDbs = (data.data.qdrant_databases || []).map((db: any) => ({
            id: db.id || generateId(),
            email: db.email || '',
            cluster_name: db.cluster_name || db.name || '',
            cluster_api_key: db.cluster_api_key || db.api_key || '',
            cluster_endpoint: db.cluster_endpoint || db.endpoint || '',
          }));

          // Convert old gemini keys format to new format
          let geminiKeys: GeminiKeyConfig[] = [];
          if (Array.isArray(data.data.gemini_api_keys)) {
            geminiKeys = data.data.gemini_api_keys.map((key: any) => {
              if (typeof key === 'string') {
                // Old format: just string
                return { id: generateId(), email: '', api_key: key };
              }
              return {
                id: key.id || generateId(),
                email: key.email || '',
                api_key: key.api_key || '',
              };
            });
          }

          setConfig({
            rag_enabled: data.data.rag_enabled ?? true,
            qdrant_databases: qdrantDbs,
            gemini_api_keys: geminiKeys,
            rerank_enabled: true, // Always enabled
          });
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveGeneralConfig = async () => {
    try {
      setSaving(true);
      // Save General Config to localStorage only
      localStorage.setItem('ELARA_API_URL', generalConfig.apiUrl);
      window.dispatchEvent(new Event('storage')); // Notify other components
      toast.success('General settings saved successfully');
    } catch (error) {
      console.error('Failed to save general config:', error);
      toast.error('Failed to save general settings');
    } finally {
      setSaving(false);
    }
  };

  const saveIndexingConfig = async () => {
    try {
      setSaving(true);

      const serverStatus = await window.api.server.start();
      const port = serverStatus.port || 11434;

      const response = await fetch(`http://localhost:${port}/v1/config/rag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          rerank_enabled: true, // Always enabled
        }),
      });

      if (response.ok) {
        toast.success('Indexing settings saved successfully');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save indexing config:', error);
      toast.error('Failed to save indexing settings');
    } finally {
      setSaving(false);
    }
  };

  const generateId = () => Math.random().toString(36).substring(2, 10);

  // Qdrant handlers
  const saveQdrantDatabase = () => {
    if (!editingQdrant?.cluster_api_key.trim() || !editingQdrant?.cluster_endpoint.trim()) {
      toast.error('Cluster API Key and Endpoint are required');
      return;
    }

    setConfig((prev) => {
      const existing = prev.qdrant_databases.find((db) => db.id === editingQdrant.id);
      if (existing) {
        return {
          ...prev,
          qdrant_databases: prev.qdrant_databases.map((db) =>
            db.id === editingQdrant.id ? editingQdrant : db,
          ),
        };
      } else {
        return {
          ...prev,
          qdrant_databases: [...prev.qdrant_databases, { ...editingQdrant, id: generateId() }],
        };
      }
    });
    setEditingQdrant(null);
    setShowQdrantForm(false);
  };

  const removeQdrantDatabase = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      qdrant_databases: prev.qdrant_databases.filter((db) => db.id !== id),
    }));
  };

  const startAddQdrant = () => {
    setEditingQdrant({
      id: '',
      email: '',
      cluster_name: '',
      cluster_api_key: '',
      cluster_endpoint: '',
    });
    setShowQdrantForm(true);
  };

  const startEditQdrant = (db: QdrantConfig) => {
    setEditingQdrant({ ...db });
    setShowQdrantForm(true);
  };

  // Gemini handlers
  const saveGeminiKey = () => {
    if (!editingGemini?.email.trim() || !editingGemini?.api_key.trim()) {
      toast.error('Email and API Key are required');
      return;
    }

    setConfig((prev) => {
      const existing = prev.gemini_api_keys.find((k) => k.id === editingGemini.id);
      if (existing) {
        return {
          ...prev,
          gemini_api_keys: prev.gemini_api_keys.map((k) =>
            k.id === editingGemini.id ? editingGemini : k,
          ),
        };
      } else {
        return {
          ...prev,
          gemini_api_keys: [...prev.gemini_api_keys, { ...editingGemini, id: generateId() }],
        };
      }
    });
    setEditingGemini(null);
    setShowGeminiForm(false);
  };

  const removeGeminiKey = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      gemini_api_keys: prev.gemini_api_keys.filter((k) => k.id !== id),
    }));
  };

  const startAddGemini = () => {
    setEditingGemini({ id: '', email: '', api_key: '' });
    setShowGeminiForm(true);
  };

  const startEditGemini = (key: GeminiKeyConfig) => {
    setEditingGemini({ ...key });
    setShowGeminiForm(true);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '********';
    return key.slice(0, 4) + '********' + key.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sidebarItems = [
    { id: 'general' as SidebarOption, label: 'General', icon: Settings, color: '#94a3b8' }, // Slate
    {
      id: 'indexing' as SidebarOption,
      label: 'Indexing Codebase',
      icon: FolderSearch,
      color: '#f59e0b',
    }, // Amber
  ];

  return (
    <div className="h-full flex flex-row bg-background">
      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col shrink-0 h-full transition-all">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">Settings</span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                'w-full flex items-center gap-3 py-3 px-6 text-sm font-medium rounded-none transition-all relative group text-left',
                activeSection === item.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              style={
                activeSection === item.id
                  ? {
                      background: `linear-gradient(to right, ${item.color}15, transparent)`,
                    }
                  : undefined
              }
            >
              {activeSection === item.id && (
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-lg"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <item.icon
                className={cn('w-5 h-5 flex-shrink-0 transition-colors')}
                style={{ color: activeSection === item.id ? item.color : undefined }}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background h-full">
        {/* Content HeaderBar */}
        <div className="h-16 flex items-center px-8 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {activeSection === 'general' ? 'General Configuration' : 'Indexing & RAG'}
          </h2>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {activeSection === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">General Settings</h3>
                  <p className="text-base text-muted-foreground mt-1">
                    Configure general application behavior and connections.
                  </p>
                </div>

                <div className="p-6 rounded-lg border border-border bg-card/20 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      Backend API URL <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={generalConfig.apiUrl}
                      onChange={(e) =>
                        setGeneralConfig({ ...generalConfig, apiUrl: e.target.value })
                      }
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                    />
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      The URL of the Elara backend server (Ollama compatible). Change this if you
                      are hosting the server remotely.
                    </p>
                  </div>

                  <div className="flex justify-start pt-2">
                    <button
                      onClick={saveGeneralConfig}
                      disabled={saving}
                      className={cn(
                        'px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm',
                        saving
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90',
                      )}
                    >
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving ? 'Saving...' : 'Save General Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'indexing' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Codebase Indexing</h3>
                  <p className="text-base text-muted-foreground mt-1">
                    Manage Vector Database connections and Embedding API keys.
                  </p>
                </div>

                {/* Qdrant Databases */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Database className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Qdrant Databases</h3>
                        <p className="text-xs text-muted-foreground">Vector storage clusters</p>
                      </div>
                    </div>
                    <button
                      onClick={startAddQdrant}
                      className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Database
                    </button>
                  </div>

                  <div className="space-y-3">
                    {config.qdrant_databases.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-muted-foreground/25 rounded-xl bg-card/10">
                        <Database className="w-10 h-10 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground font-medium">
                          No Qdrant databases configured
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Add a database to enable semantic search.
                        </p>
                      </div>
                    ) : (
                      config.qdrant_databases.map((db) => (
                        <div
                          key={db.id}
                          className="flex items-center gap-4 p-4 bg-card/40 rounded-xl border border-border hover:border-primary/30 transition-all group shadow-sm"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Server className="w-5 h-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">
                                {db.cluster_name || 'Unnamed Cluster'}
                              </p>
                              {db.email && (
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {db.email}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-md">
                              {db.cluster_endpoint}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEditQdrant(db)}
                              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                              title="Edit"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeQdrantDatabase(db.id)}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Add/Edit Qdrant Form */}
                    {showQdrantForm && editingQdrant && (
                      <div className="p-6 bg-card/60 backdrop-blur-md rounded-xl border border-border shadow-lg space-y-4 animate-in zoom-in-95 duration-200">
                        <h4 className="font-semibold text-sm border-b pb-2 mb-2 flex items-center gap-2">
                          <Server className="w-4 h-4 text-primary" />
                          {editingQdrant.id ? 'Edit Database' : 'New Qdrant Database'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Email (Optional)
                            </label>
                            <input
                              type="email"
                              value={editingQdrant.email || ''}
                              onChange={(e) =>
                                setEditingQdrant((prev) =>
                                  prev ? { ...prev, email: e.target.value } : null,
                                )
                              }
                              placeholder="your@email.com"
                              className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Cluster Name
                            </label>
                            <input
                              type="text"
                              value={editingQdrant.cluster_name || ''}
                              onChange={(e) =>
                                setEditingQdrant((prev) =>
                                  prev ? { ...prev, cluster_name: e.target.value } : null,
                                )
                              }
                              placeholder="My Cluster"
                              className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Cluster Endpoint <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            value={editingQdrant.cluster_endpoint}
                            onChange={(e) =>
                              setEditingQdrant((prev) =>
                                prev ? { ...prev, cluster_endpoint: e.target.value } : null,
                              )
                            }
                            placeholder="https://xxx.qdrant.io:6333"
                            className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            API Key <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showApiKeys[editingQdrant.id || 'new'] ? 'text' : 'password'}
                              value={editingQdrant.cluster_api_key}
                              onChange={(e) =>
                                setEditingQdrant((prev) =>
                                  prev ? { ...prev, cluster_api_key: e.target.value } : null,
                                )
                              }
                              placeholder="Enter Cluster API key"
                              className="w-full px-3 py-2 pr-10 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowApiKeys((prev) => ({
                                  ...prev,
                                  [editingQdrant.id || 'new']: !prev[editingQdrant.id || 'new'],
                                }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
                            >
                              {showApiKeys[editingQdrant.id || 'new'] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2 justify-end">
                          <button
                            onClick={() => {
                              setEditingQdrant(null);
                              setShowQdrantForm(false);
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveQdrantDatabase}
                            className="px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                          >
                            <Check className="w-4 h-4" />
                            Save Database
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Gemini API Keys */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-500/10 rounded-lg">
                        <Key className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Gemini API Keys</h3>
                        <p className="text-xs text-muted-foreground">For embedding generation</p>
                      </div>
                    </div>
                    <button
                      onClick={startAddGemini}
                      className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Key
                    </button>
                  </div>

                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border border-border/50 flex items-start gap-2">
                    <span className="text-primary text-lg leading-none">ℹ</span>
                    Add multiple Gemini API keys. The system will rotate through them to avoid rate
                    limits during heavy indexing tasks.
                  </p>

                  <div className="space-y-3">
                    {config.gemini_api_keys.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-destructive/25 bg-destructive/5 rounded-xl">
                        <Key className="w-10 h-10 text-destructive/50 mb-3" />
                        <p className="text-sm font-semibold text-destructive">
                          No API keys configured
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          At least one key is required.
                        </p>
                      </div>
                    ) : (
                      config.gemini_api_keys.map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center gap-4 p-4 bg-card/40 rounded-xl border border-border hover:border-primary/30 transition-all group shadow-sm"
                        >
                          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Key className="w-5 h-5 text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{key.email}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                              {showGeminiKeys[key.id] ? key.api_key : maskApiKey(key.api_key)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() =>
                                setShowGeminiKeys((prev) => ({ ...prev, [key.id]: !prev[key.id] }))
                              }
                              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                              title={showGeminiKeys[key.id] ? 'Hide Key' : 'Show Key'}
                            >
                              {showGeminiKeys[key.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => startEditGemini(key)}
                              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                              title="Edit"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeGeminiKey(key.id)}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Add/Edit Gemini Form */}
                    {showGeminiForm && editingGemini && (
                      <div className="p-6 bg-card/60 backdrop-blur-md rounded-xl border border-border shadow-lg space-y-4 animate-in zoom-in-95 duration-200">
                        <h4 className="font-semibold text-sm border-b pb-2 mb-2 flex items-center gap-2">
                          <Key className="w-4 h-4 text-primary" />
                          {editingGemini.id ? 'Edit API Key' : 'New One-Time Key'}
                        </h4>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Email <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="email"
                            value={editingGemini.email}
                            onChange={(e) =>
                              setEditingGemini((prev) =>
                                prev ? { ...prev, email: e.target.value } : null,
                              )
                            }
                            placeholder="your@email.com"
                            className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            API Key <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showGeminiKeys[editingGemini.id || 'new'] ? 'text' : 'password'}
                              value={editingGemini.api_key}
                              onChange={(e) =>
                                setEditingGemini((prev) =>
                                  prev ? { ...prev, api_key: e.target.value } : null,
                                )
                              }
                              placeholder="Enter Gemini API key"
                              className="w-full px-3 py-2 pr-10 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowGeminiKeys((prev) => ({
                                  ...prev,
                                  [editingGemini.id || 'new']: !prev[editingGemini.id || 'new'],
                                }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
                            >
                              {showGeminiKeys[editingGemini.id || 'new'] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2 justify-end">
                          <button
                            onClick={() => {
                              setEditingGemini(null);
                              setShowGeminiForm(false);
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveGeminiKey}
                            className="px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                          >
                            <Check className="w-4 h-4" />
                            Save Key
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-6 border-t">
                  <button
                    onClick={saveIndexingConfig}
                    disabled={saving}
                    className={cn(
                      'px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-all shadow-md active:scale-95',
                      saving
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90',
                    )}
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? 'Saving...' : 'Save All Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
