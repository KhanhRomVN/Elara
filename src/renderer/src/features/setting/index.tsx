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

  const saveConfig = async () => {
    try {
      setSaving(true);

      // Save General Config
      localStorage.setItem('ELARA_API_URL', generalConfig.apiUrl);
      window.dispatchEvent(new Event('storage')); // Notify other components

      const serverStatus = await window.api.server.start();
      const port = serverStatus.port || 11434;

      // Use configured URL if it points to localhost/different port,
      // but for saving RAG config, we typically save to the *current* backend.
      // If the User changes the URL, they are effectively pointing to a NEW backend.
      // The settings here (RAG, Qdrant) belong to the backend.
      // So if we save, we should save to the backend we are currently connected to (or trying to).

      // For safety, let's try to save to the configured URL if possible, or fallback to local.
      // But typically `loadConfig` fetches from local.
      // Let's assume for now we still sync with local backend for RAG settings.

      const response = await fetch(`http://localhost:${port}/v1/config/rag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          rerank_enabled: true, // Always enabled
        }),
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save settings');
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
    { id: 'general' as SidebarOption, label: 'General', icon: Settings },
    { id: 'indexing' as SidebarOption, label: 'Indexing Codebase', icon: FolderSearch },
  ];

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r bg-muted/20 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
        <nav className="flex-1 p-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                activeSection === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-8">
          {activeSection === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">General Settings</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure general application settings.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    API URL <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={generalConfig.apiUrl}
                    onChange={(e) => setGeneralConfig({ ...generalConfig, apiUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    The URL of the Elara backend server. Change this if you are hosting the server
                    remotely or on a different port.
                  </p>
                </div>
              </div>

              <div className="flex justify-start pt-4 border-t">
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className={cn(
                    'px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors',
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
          )}

          {activeSection === 'indexing' && (
            <>
              <div>
                <h2 className="text-xl font-bold">Indexing Codebase</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure Qdrant database and Gemini API keys for codebase indexing and semantic
                  search
                </p>
              </div>

              {/* Qdrant Databases */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Qdrant Databases</h3>
                  </div>
                  <button
                    onClick={startAddQdrant}
                    className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Database
                  </button>
                </div>

                <div className="space-y-2">
                  {config.qdrant_databases.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                      No Qdrant databases configured. Add one to start indexing.
                    </p>
                  ) : (
                    config.qdrant_databases.map((db) => (
                      <div
                        key={db.id}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border group"
                      >
                        <Server className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {db.cluster_name || db.cluster_endpoint}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {db.email ? `${db.email} - ` : ''}
                            {db.cluster_endpoint}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditQdrant(db)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeQdrantDatabase(db.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add/Edit Qdrant Form */}
                  {showQdrantForm && editingQdrant && (
                    <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                          Email <span className="text-muted-foreground">(optional)</span>
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
                        <label className="text-sm font-medium">
                          Cluster Name <span className="text-muted-foreground">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={editingQdrant.cluster_name || ''}
                          onChange={(e) =>
                            setEditingQdrant((prev) =>
                              prev ? { ...prev, cluster_name: e.target.value } : null,
                            )
                          }
                          placeholder="My Qdrant Cluster"
                          className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
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
                          className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                          Cluster API Key <span className="text-destructive">*</span>
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
                            className="w-full px-3 py-2 pr-10 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowApiKeys((prev) => ({
                                ...prev,
                                [editingQdrant.id || 'new']: !prev[editingQdrant.id || 'new'],
                              }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKeys[editingQdrant.id || 'new'] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setEditingQdrant(null);
                            setShowQdrantForm(false);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveQdrantDatabase}
                          className="flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Gemini API Keys */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Gemini API Keys</h3>
                  </div>
                  <button
                    onClick={startAddGemini}
                    className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Key
                  </button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Add multiple Gemini API keys for embedding. Keys will be rotated to avoid rate
                  limits.
                </p>

                <div className="space-y-2">
                  {config.gemini_api_keys.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                      No Gemini API keys configured. Add at least one for codebase embedding.
                    </p>
                  ) : (
                    config.gemini_api_keys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border group"
                      >
                        <Key className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{key.email}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {showGeminiKeys[key.id] ? key.api_key : maskApiKey(key.api_key)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              setShowGeminiKeys((prev) => ({ ...prev, [key.id]: !prev[key.id] }))
                            }
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                          >
                            {showGeminiKeys[key.id] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => startEditGemini(key)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeGeminiKey(key.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add/Edit Gemini Form */}
                  {showGeminiForm && editingGemini && (
                    <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
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
                        <label className="text-sm font-medium">
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
                            className="w-full px-3 py-2 pr-10 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowGeminiKeys((prev) => ({
                                ...prev,
                                [editingGemini.id || 'new']: !prev[editingGemini.id || 'new'],
                              }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                          >
                            {showGeminiKeys[editingGemini.id || 'new'] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setEditingGemini(null);
                            setShowGeminiForm(false);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveGeminiKey}
                          className="flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {config.gemini_api_keys.length === 0 && (
                  <p className="text-xs text-amber-500">
                    At least one Gemini API key is required for codebase embedding
                  </p>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className={cn(
                    'px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors',
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
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
