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
  Languages,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../shared/lib/utils';
import { LanguageSelector } from '../playground/components/LanguageSelector';

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

type SidebarOption = 'indexing' | 'general' | 'provider';

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
    language: localStorage.getItem('elara_preferred_language') || null,
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
      if (generalConfig.language) {
        localStorage.setItem('elara_preferred_language', generalConfig.language);
      } else {
        localStorage.removeItem('elara_preferred_language');
      }
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
      id: 'provider' as SidebarOption,
      label: 'Provider',
      icon: Server,
      color: '#8b5cf6', // Purple
    },
    {
      id: 'indexing' as SidebarOption,
      label: 'Indexing Codebase (Disabled)',
      icon: FolderSearch,
      color: '#64748b',
      disabled: true,
    }, // Slate
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
          {sidebarItems.map((item: any) => (
            <button
              key={item.id}
              onClick={() => !item.disabled && setActiveSection(item.id)}
              disabled={item.disabled}
              className={cn(
                'w-full flex items-center gap-3 py-3 px-6 text-sm font-medium rounded-none transition-all relative group text-left',
                activeSection === item.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
                item.disabled && 'opacity-50 cursor-not-allowed grayscale',
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      Response Language
                    </label>
                    <LanguageSelector
                      value={generalConfig.language}
                      onChange={(val) => setGeneralConfig({ ...generalConfig, language: val })}
                      className="w-full"
                    />
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      Select the default language for AI responses.
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

            {activeSection === 'provider' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Provider Settings</h3>
                  <p className="text-base text-muted-foreground mt-1">
                    Configure AI providers and API keys.
                  </p>
                </div>

                <div className="p-12 rounded-lg border border-border bg-card/20 flex flex-col items-center justify-center text-center space-y-4">
                  <Server className="w-16 h-16 text-muted-foreground/30" />
                  <div>
                    <h4 className="text-lg font-medium">Coming Soon</h4>
                    <p className="text-sm text-muted-foreground max-w-md mt-1">
                      Provider management interface is currently under development. This section
                      will allow you to configure and manage AI providers, API keys, and model
                      settings.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/50 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50"></div>
                    <span>Temporary placeholder - full functionality coming soon</span>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'indexing' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Codebase Indexing</h3>
                  <p className="text-base text-muted-foreground mt-1 text-destructive">
                    This feature is currently disabled and all associated backend services have been
                    removed.
                  </p>
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
