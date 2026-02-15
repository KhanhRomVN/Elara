import { useState } from 'react';
import { Server, Zap } from 'lucide-react';
import { cn } from '@renderer/shared/lib/utils';
import { CodeBlock } from '@renderer/core/components/CodeBlock';

interface APIEndpoint {
  path: string;
  method: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  requestFields?: { name: string; type: string; required: boolean; description: string }[];
  responseFields?: { name: string; type: string; description: string }[];
  requestBody?: string;
  responseBody?: string;
  queryParams?: string;
}

interface EmbeddedAPI {
  category: string;
  endpoints: APIEndpoint[];
}

const embeddedAPIs: EmbeddedAPI[] = [
  {
    category: 'Account Management',
    endpoints: [
      {
        path: '/v1/accounts',
        method: 'GET',
        description: 'Get all accounts from the database with optional filtering',
        params: [
          {
            name: 'page',
            type: 'number',
            required: false,
            description: 'Page number for pagination (default: 1)',
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Number of items per page (default: 10)',
          },
          {
            name: 'provider_id',
            type: 'string',
            required: false,
            description: 'Filter by provider ID',
          },
        ],
        queryParams: 'page=1&limit=10&provider_id=<provider_id>',
        responseBody: `{
  "success": true,
  "message": "Accounts retrieved successfully",
  "data": [
    {
      "id": "acc_123456",
      "email": "user@example.com",
      "provider_id": "<provider_id>",
      "credential": "...",
      "created_at": "2026-01-19T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-01-19T00:00:00.000Z",
    "page": 1,
    "limit": 10,
    "total": 25
  }
}`,
        responseFields: [
          { name: 'success', type: 'boolean', description: 'Request success status' },
          { name: 'message', type: 'string', description: 'Human-readable message' },
          { name: 'data', type: 'array', description: 'Array of account objects' },
          { name: 'data[].id', type: 'string', description: 'Unique account identifier' },
          { name: 'data[].email', type: 'string', description: 'Account email address' },
          { name: 'data[].provider_id', type: 'string', description: 'Provider name' },
          { name: 'data[].credential', type: 'object', description: 'Authentication credentials' },
          { name: 'meta.page', type: 'number', description: 'Current page number' },
          { name: 'meta.limit', type: 'number', description: 'Items per page' },
          { name: 'meta.total', type: 'number', description: 'Total number of accounts' },
        ],
      },
      {
        path: '/v1/accounts/:id',
        method: 'DELETE',
        description: 'Delete an account by ID',
        responseBody: `{
  "success": true,
  "message": "Account deleted successfully",
  "meta": {
    "timestamp": "2026-01-19T00:00:00.000Z"
  }
}`,
      },
      {
        path: '/v1/accounts/import',
        method: 'POST',
        description: 'Import multiple accounts at once',
        requestBody: `{
  "accounts": [
    {
      "email": "user1@example.com",
      "provider_id": "<provider_id>",
      "credential": {
        "cookie": "session=...",
        "jwt": "eyJ..."
      }
    }
  ]
}`,
        requestFields: [
          {
            name: 'accounts',
            type: 'array',
            required: true,
            description: 'Array of account objects to import',
          },
          {
            name: 'accounts[].email',
            type: 'string',
            required: true,
            description: 'Account email',
          },
          {
            name: 'accounts[].provider_id',
            type: 'string',
            required: true,
            description: 'Provider identifier',
          },
          {
            name: 'accounts[].credential',
            type: 'object',
            required: true,
            description: 'Authentication credentials',
          },
          {
            name: 'accounts[].credential.cookie',
            type: 'string',
            required: false,
            description: 'Session cookie',
          },
          {
            name: 'accounts[].credential.jwt',
            type: 'string',
            required: false,
            description: 'JWT token',
          },
        ],
        responseBody: `{
  "success": true,
  "message": "Accounts imported successfully",
  "data": {
    "imported": 2,
    "failed": 0
  }
}`,
      },
    ],
  },
  {
    category: 'Providers',
    endpoints: [
      {
        path: '/v1/providers',
        method: 'GET',
        description: 'Get all available providers and their configurations',
        responseBody: `{
  "success": true,
  "data": [
    {
      "id": "provider-1",
      "name": "<provider_name>",
      "description": "<description>",
      "icon": "...",
      "active": true
    },
    {
      "id": "provider-2",
      "name": "<provider_name>",
      "description": "<description>",
      "icon": "...",
      "active": true
    }
  ]
}`,
        responseFields: [
          { name: 'success', type: 'boolean', description: 'Request success status' },
          { name: 'data', type: 'array', description: 'Array of provider configurations' },
          { name: 'data[].id', type: 'string', description: 'Provider unique identifier' },
          { name: 'data[].name', type: 'string', description: 'Provider display name' },
          { name: 'data[].description', type: 'string', description: 'Short description' },
          { name: 'data[].active', type: 'boolean', description: 'Whether provider is enabled' },
        ],
      },
      {
        path: '/v1/providers/:providerId/models',
        method: 'GET',
        description: 'Get available models for a specific provider (unified endpoint)',
        params: [
          {
            name: 'providerId',
            type: 'string',
            required: true,
            description: 'Provider identifier',
          },
          {
            name: 'email',
            type: 'string',
            required: false,
            description: 'Required only for dynamic providers',
          },
        ],
        queryParams: 'email=user@example.com',
        responseBody: `{
  "success": true,
  "data": [
    {
      "id": "<model_id>",
      "name": "<model_name>"
    }
  ],
  "source": "static"
}`,
        responseFields: [
          { name: 'success', type: 'boolean', description: 'Request success status' },
          { name: 'data', type: 'array', description: 'Array of model objects' },
          { name: 'data[].id', type: 'string', description: 'Model identifier' },
          { name: 'data[].name', type: 'string', description: 'Model display name' },
          {
            name: 'source',
            type: 'string',
            description: 'Data source: "static" (hardcoded) or "dynamic" (from API)',
          },
        ],
      },
    ],
  },
  {
    category: 'Models',
    endpoints: [
      {
        path: '/v1/models/all',
        method: 'GET',
        description: 'Get all available models from enabled providers only',
        responseBody: `{
  "success": true,
  "message": "Models retrieved successfully",
  "data": [
    {
      "id": "<model_id>",
      "name": "<model_name>",
      "provider_id": "<provider_id>",
      "provider_name": "<provider_name>"
    }
  ]
}`,
      },
    ],
  },
  {
    category: 'Conversation Management',
    endpoints: [
      {
        path: '/v1/accounts/:accountId/conversations',
        method: 'GET',
        description: 'Get conversation history for an account',
        params: [
          {
            name: 'accountId',
            type: 'string',
            required: true,
            description: 'Account ID from path parameter',
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Number of conversations to return (default: 30)',
          },
          {
            name: 'page',
            type: 'number',
            required: false,
            description: 'Page number for pagination (default: 1)',
          },
        ],
        queryParams: 'limit=30&page=1',
        responseBody: `{
  "success": true,
  "message": "Conversations retrieved successfully",
  "data": {
    "conversations": [
      {
        "id": "conv_123",
        "title": "Code Review Discussion",
        "created_at": "2026-01-18T10:00:00.000Z",
        "updated_at": "2026-01-18T15:30:00.000Z",
        "message_count": 12
      }
    ],
    "account": {
      "id": "acc_123456",
      "email": "user@example.com",
      "provider_id": "<provider_id>"
    }
  }
}`,
      },
      {
        path: '/v1/accounts/:accountId/conversations/:conversationId',
        method: 'GET',
        description: 'Get detailed conversation with all messages',
        params: [
          {
            name: 'accountId',
            type: 'string',
            required: true,
            description: 'Account ID from path',
          },
          {
            name: 'conversationId',
            type: 'string',
            required: true,
            description: 'Conversation ID from path',
          },
        ],
        responseBody: `{
  "success": true,
  "message": "Conversation details retrieved successfully",
  "data": {
    "conversation": {
      "id": "conv_123",
      "title": "Code Review Discussion",
      "messages": [
        {
          "id": "msg_1",
          "role": "user",
          "content": "Can you review this code?",
          "created_at": "2026-01-18T10:00:00.000Z"
        },
        {
          "id": "msg_2",
          "role": "assistant",
          "content": "Sure! Let me analyze it...",
          "created_at": "2026-01-18T10:00:15.000Z"
        }
      ]
    }
  }
}`,
      },
    ],
  },
  {
    category: 'Chat & Messaging',
    endpoints: [
      {
        path: '/v1/chat/accounts/:accountId/messages',
        method: 'POST',
        description: 'Send a message to a specific account (supports streaming)',
        params: [
          {
            name: 'accountId',
            type: 'string',
            required: true,
            description: 'Account ID from path parameter',
          },
        ],
        requestBody: `{
  "model": "<model_id>",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "conversationId": "conv_123",
  "stream": true,
  "search": false,
  "ref_file_ids": []
}`,
        requestFields: [
          { name: 'model', type: 'string', required: true, description: 'Model identifier' },
          {
            name: 'messages',
            type: 'array',
            required: true,
            description: 'Array of message objects',
          },
          {
            name: 'messages[].role',
            type: 'string',
            required: true,
            description: 'Message role (user/assistant)',
          },
          {
            name: 'messages[].content',
            type: 'string',
            required: true,
            description: 'Message content',
          },
          {
            name: 'conversationId',
            type: 'string',
            required: false,
            description: 'Existing conversation ID',
          },
          {
            name: 'stream',
            type: 'boolean',
            required: false,
            description: 'Enable streaming (default: true)',
          },
          { name: 'search', type: 'boolean', required: false, description: 'Enable web search' },
          {
            name: 'ref_file_ids',
            type: 'array',
            required: false,
            description: 'Referenced file IDs',
          },
        ],
        responseBody: `// Streaming response (SSE format)
data: {"content":"Hello"}
data: {"content":"! I'm"}
data: {"content":" doing"}
data: {"content":" well"}
data: {"meta":{"conversationId":"conv_123"}}
data: [DONE]

// Non-streaming response
{
  "success": true,
  "message": {
    "role": "assistant",
    "content": "Hello! I'm doing well."
  },
  "metadata": {
    "conversationId": "conv_123",
    "model": "<model_id>"
  }
}`,
      },
      {
        path: '/v1/chat/accounts/:accountId/uploads',
        method: 'POST',
        description: 'Upload a file for use in chat (multipart/form-data)',
        params: [
          {
            name: 'accountId',
            type: 'string',
            required: true,
            description: 'Account ID from path parameter',
          },
        ],
        requestBody: `// Form data (multipart/form-data)
Content-Type: multipart/form-data

file: [binary file data]`,
        responseBody: `{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file_id": "file_abc123",
    "filename": "document.pdf",
    "size": 1024000,
    "mime_type": "application/pdf",
    "url": "http://localhost:8888/uploads/file_abc123"
  }
}`,
        responseFields: [
          { name: 'success', type: 'boolean', description: 'Upload success status' },
          { name: 'data.file_id', type: 'string', description: 'Unique file identifier' },
          { name: 'data.filename', type: 'string', description: 'Original filename' },
          { name: 'data.size', type: 'number', description: 'File size in bytes' },
          { name: 'data.mime_type', type: 'string', description: 'File MIME type' },
          { name: 'data.url', type: 'string', description: 'File access URL' },
        ],
      },
    ],
  },
];

export default function TutorialPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-row bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card/30 flex flex-col shrink-0 h-full transition-all">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight">Tutorial</h2>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-4 px-4">
              Explore local server APIs and integration patterns.
            </p>
            {embeddedAPIs.map((category) => (
              <div key={category.category} className="mb-6 last:mb-0">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide px-6">
                  {category.category}
                </h4>
                <div className="space-y-0.5">
                  {category.endpoints.map((endpoint) => (
                    <button
                      key={endpoint.path}
                      onClick={() => setSelectedEndpoint(endpoint.path)}
                      className={cn(
                        'w-full text-left py-3 px-6 transition-all group relative flex flex-col gap-1.5',
                        selectedEndpoint === endpoint.path
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      style={
                        selectedEndpoint === endpoint.path
                          ? {
                              background: `linear-gradient(to right, ${
                                endpoint.method === 'GET'
                                  ? '#3b82f6'
                                  : endpoint.method === 'POST'
                                    ? '#22c55e'
                                    : endpoint.method === 'DELETE'
                                      ? '#ef4444'
                                      : endpoint.method === 'PUT'
                                        ? '#eab308'
                                        : '#a855f7'
                              }15, transparent)`,
                            }
                          : undefined
                      }
                    >
                      {selectedEndpoint === endpoint.path && (
                        <div
                          className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-full"
                          style={{
                            backgroundColor:
                              endpoint.method === 'GET'
                                ? '#3b82f6'
                                : endpoint.method === 'POST'
                                  ? '#22c55e'
                                  : endpoint.method === 'DELETE'
                                    ? '#ef4444'
                                    : endpoint.method === 'PUT'
                                      ? '#eab308'
                                      : '#a855f7',
                          }}
                        />
                      )}

                      <span className="text-sm font-medium leading-tight line-clamp-2">
                        {endpoint.description}
                      </span>

                      <div className="flex items-start gap-2 w-full">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono font-bold shrink-0 uppercase tracking-tighter mt-0.5',
                            endpoint.method === 'GET'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : endpoint.method === 'POST'
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                : endpoint.method === 'DELETE'
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                  : endpoint.method === 'PUT'
                                    ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                          )}
                        >
                          {endpoint.method}
                        </span>
                        <span className="font-mono text-xs opacity-70 group-hover:opacity-100 transition-opacity break-all text-left">
                          {endpoint.path}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background h-full">
        {/* Content HeaderBar */}
        <div className="h-16 flex items-center px-6 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            {selectedEndpoint ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                API Documentation
              </>
            ) : (
              'Select an API Endpoint'
            )}
          </h2>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {selectedEndpoint ? (
            <div className="max-w-4xl mx-auto pb-20 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {(() => {
                const endpoint = embeddedAPIs
                  .flatMap((cat) => cat.endpoints)
                  .find((ep) => ep.path === selectedEndpoint);

                if (!endpoint) return null;

                return (
                  <>
                    {/* Endpoint Definition Header */}
                    <div className="space-y-4 pb-6 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'px-3 py-1 rounded-md text-sm font-mono font-bold uppercase tracking-wider',
                            endpoint.method === 'GET'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : endpoint.method === 'POST'
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                : endpoint.method === 'DELETE'
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                  : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
                          )}
                        >
                          {endpoint.method}
                        </span>
                        <code className="text-xl font-mono text-foreground font-medium select-all">
                          {endpoint.path}
                        </code>
                      </div>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        {endpoint.description}
                      </p>
                    </div>

                    {/* Path/Query Parameters */}
                    {endpoint.params && endpoint.params.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
                          Parameters
                        </h4>
                        <div className="rounded-lg border border-border overflow-hidden bg-card/20">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold">
                              <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Required</th>
                                <th className="px-4 py-3">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {endpoint.params.map((param, idx) => (
                                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-mono">
                                      {param.name}
                                    </code>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                    {param.type}
                                  </td>
                                  <td className="px-4 py-3">
                                    {param.required ? (
                                      <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Required
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Optional
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {param.description}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {endpoint.queryParams && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md border border-border/50 font-mono">
                            <span className="font-semibold text-foreground shrink-0">
                              Query Example:
                            </span>
                            <span className="select-all break-all">{endpoint.queryParams}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Request/Response Split View */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      {/* Request Section */}
                      {(endpoint.requestBody ||
                        (endpoint.requestFields && endpoint.requestFields.length > 0)) && (
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            Request
                            <span className="text-[10px] font-normal text-muted-foreground normal-case bg-muted px-1.5 py-0.5 rounded">
                              application/json
                            </span>
                          </h4>

                          {/* Request Fields Table */}
                          {endpoint.requestFields && endpoint.requestFields.length > 0 && (
                            <div className="rounded-lg border border-border overflow-hidden bg-card/20 mb-4">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold">
                                  <tr>
                                    <th className="px-3 py-2">Field</th>
                                    <th className="px-3 py-2">Type</th>
                                    <th className="px-3 py-2">Req</th>
                                    <th className="px-3 py-2">Desc</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                  {endpoint.requestFields.map((field, idx) => (
                                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                      <td className="px-3 py-2">
                                        <code className="text-xs font-mono">{field.name}</code>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                                        {field.type}
                                      </td>
                                      <td className="px-3 py-2 text-xs">
                                        {field.required && (
                                          <span className="text-red-500 font-bold">•</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-muted-foreground leading-tight">
                                        {field.description}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Request Code Block */}
                          {endpoint.requestBody && (
                            <CodeBlock
                              code={endpoint.requestBody}
                              language="json"
                              maxLines={30}
                              showLineNumbers={false}
                              editorOptions={{
                                guides: { indentation: false },
                                renderLineHighlight: 'none',
                                readOnly: true,
                                minimap: { enabled: false },
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* Response Section */}
                      {(endpoint.responseBody ||
                        (endpoint.responseFields && endpoint.responseFields.length > 0)) && (
                        <div
                          className={cn(
                            'space-y-4',
                            !endpoint.requestBody && !endpoint.requestFields ? 'xl:col-span-2' : '',
                          )}
                        >
                          <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            Response
                            <span className="text-[10px] font-normal text-muted-foreground normal-case bg-muted px-1.5 py-0.5 rounded">
                              application/json
                            </span>
                          </h4>

                          {endpoint.responseBody && (
                            <CodeBlock
                              code={endpoint.responseBody}
                              language="json"
                              maxLines={30}
                              showLineNumbers={false}
                              editorOptions={{
                                guides: { indentation: false },
                                renderLineHighlight: 'none',
                                readOnly: true,
                                minimap: { enabled: false },
                              }}
                            />
                          )}

                          {endpoint.responseFields && endpoint.responseFields.length > 0 && (
                            <div className="rounded-lg border border-border overflow-hidden bg-card/20 mt-4">
                              <div className="px-3 py-2 bg-muted/50 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase">
                                schema
                              </div>
                              <div className="p-0">
                                <table className="w-full text-xs text-left">
                                  <tbody className="divide-y divide-border/50">
                                    {endpoint.responseFields.map((field, idx) => (
                                      <tr key={idx} className="hover:bg-muted/30">
                                        <td className="px-3 py-2 font-mono text-foreground/80 w-1/3">
                                          {field.name}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-muted-foreground w-1/6">
                                          {field.type}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {field.description}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Complete API Reference
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Select an endpoint from the sidebar to view detailed request parameters, response
                  schemas, and example usage for the Elara Embedded Server.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
