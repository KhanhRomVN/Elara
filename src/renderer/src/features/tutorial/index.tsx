import { useState } from 'react';
import { Server, Zap } from 'lucide-react';
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
    "url": "http://localhost:11434/uploads/file_abc123"
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
    <div className="h-full flex flex-col bg-background p-4 gap-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tutorial</h2>
        <p className="text-muted-foreground">Learn how to use Elara's embedded server APIs</p>
      </div>

      {/* Main Content Box */}
      <div className="flex-1 flex overflow-hidden border border-dashed border-zinc-500/25 rounded-lg bg-card">
        {/* Sidebar - API List */}
        <div className="w-80 border-r border-border overflow-y-auto">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">Embedded Server APIs</h3>
            </div>
            <p className="text-xs text-muted-foreground">Available endpoints in the local server</p>
          </div>

          <div className="p-4 space-y-6">
            {embeddedAPIs.map((category) => (
              <div key={category.category}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  {category.category}
                </h4>
                <div className="space-y-1">
                  {category.endpoints.map((endpoint) => (
                    <button
                      key={endpoint.path}
                      onClick={() => setSelectedEndpoint(endpoint.path)}
                      className={`w-full text-left p-3 rounded-md transition-all hover:bg-muted/50 ${
                        selectedEndpoint === endpoint.path
                          ? 'bg-primary/10 border border-primary/20'
                          : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                            endpoint.method === 'GET'
                              ? 'bg-blue-500/20 text-blue-500'
                              : endpoint.method === 'POST'
                                ? 'bg-green-500/20 text-green-500'
                                : endpoint.method === 'DELETE'
                                  ? 'bg-red-500/20 text-red-500'
                                  : endpoint.method === 'PUT'
                                    ? 'bg-yellow-500/20 text-yellow-500'
                                    : 'bg-purple-500/20 text-purple-500'
                          }`}
                        >
                          {endpoint.method}
                        </span>
                        <code className="text-xs font-mono truncate flex-1">{endpoint.path}</code>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {endpoint.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedEndpoint ? (
            <div className="w-full">
              {/* Selected endpoint details */}
              {(() => {
                const endpoint = embeddedAPIs
                  .flatMap((cat) => cat.endpoints)
                  .find((ep) => ep.path === selectedEndpoint);

                if (!endpoint) return null;

                return (
                  <div className="bg-background space-y-6">
                    {/* Endpoint Header */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <span
                          className={`px-3 py-1 rounded text-sm font-mono font-semibold ${
                            endpoint.method === 'GET'
                              ? 'bg-blue-500/20 text-blue-500'
                              : endpoint.method === 'POST'
                                ? 'bg-green-500/20 text-green-500'
                                : endpoint.method === 'DELETE'
                                  ? 'bg-red-500/20 text-red-500'
                                  : 'bg-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          {endpoint.method}
                        </span>
                        <code className="text-xl font-mono">{endpoint.path}</code>
                      </div>
                      <p className="text-muted-foreground">{endpoint.description}</p>
                    </div>

                    {/* Path/Query Parameters */}
                    {endpoint.params && endpoint.params.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Parameters</h4>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-3 font-semibold">Name</th>
                                <th className="text-left p-3 font-semibold">Type</th>
                                <th className="text-left p-3 font-semibold">Required</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpoint.params.map((param, idx) => (
                                <tr key={idx} className="border-t border-border">
                                  <td className="p-3">
                                    <code className="text-xs bg-muted px-2 py-1 rounded">
                                      {param.name}
                                    </code>
                                  </td>
                                  <td className="p-3 text-muted-foreground">{param.type}</td>
                                  <td className="p-3">
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        param.required
                                          ? 'bg-red-500/20 text-red-500'
                                          : 'bg-gray-500/20 text-gray-500'
                                      }`}
                                    >
                                      {param.required ? 'Required' : 'Optional'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-muted-foreground">{param.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {endpoint.queryParams && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-1">Example:</p>
                            <code className="text-sm bg-muted px-3 py-1 rounded">
                              ?{endpoint.queryParams}
                            </code>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Request Fields */}
                    {endpoint.requestFields && endpoint.requestFields.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Request Body Fields</h4>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-3 font-semibold">Field</th>
                                <th className="text-left p-3 font-semibold">Type</th>
                                <th className="text-left p-3 font-semibold">Required</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpoint.requestFields.map((field, idx) => (
                                <tr key={idx} className="border-t border-border">
                                  <td className="p-3">
                                    <code className="text-xs bg-muted px-2 py-1 rounded">
                                      {field.name}
                                    </code>
                                  </td>
                                  <td className="p-3 text-muted-foreground">{field.type}</td>
                                  <td className="p-3">
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        field.required
                                          ? 'bg-red-500/20 text-red-500'
                                          : 'bg-gray-500/20 text-gray-500'
                                      }`}
                                    >
                                      {field.required ? 'Required' : 'Optional'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-muted-foreground">{field.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Request/Response Bodies */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {/* Request Body */}
                      {endpoint.requestBody && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Request Body Example</h4>
                          <CodeBlock
                            code={endpoint.requestBody}
                            language="json"
                            maxLines={30}
                            showLineNumbers={false}
                            editorOptions={{
                              guides: {
                                indentation: false,
                                bracketPairs: false,
                                highlightActiveIndentation: false,
                              },
                              renderLineHighlight: 'none',
                              cursorStyle: 'line-thin',
                              cursorBlinking: 'solid',
                              domReadOnly: true,
                              readOnly: true,
                              selectionHighlight: false,
                              occurrencesHighlight: false,
                              hover: { enabled: false },
                            }}
                          />
                        </div>
                      )}

                      {/* Response Body */}
                      {endpoint.responseBody && (
                        <div className={endpoint.requestBody ? '' : 'xl:col-span-2'}>
                          <h4 className="text-sm font-semibold mb-2">Response Body Example</h4>
                          <CodeBlock
                            code={endpoint.responseBody}
                            language="json"
                            maxLines={30}
                            showLineNumbers={false}
                            editorOptions={{
                              guides: {
                                indentation: false,
                                bracketPairs: false,
                                highlightActiveIndentation: false,
                              },
                              renderLineHighlight: 'none',
                              cursorStyle: 'line-thin',
                              cursorBlinking: 'solid',
                              domReadOnly: true,
                              readOnly: true,
                              selectionHighlight: false,
                              occurrencesHighlight: false,
                              hover: { enabled: false },
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Response Fields */}
                    {endpoint.responseFields && endpoint.responseFields.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Response Body Fields</h4>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-3 font-semibold">Field</th>
                                <th className="text-left p-3 font-semibold">Type</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpoint.responseFields.map((field, idx) => (
                                <tr key={idx} className="border-t border-border">
                                  <td className="p-3">
                                    <code className="text-xs bg-muted px-2 py-1 rounded">
                                      {field.name}
                                    </code>
                                  </td>
                                  <td className="p-3 text-muted-foreground">{field.type}</td>
                                  <td className="p-3 text-muted-foreground">{field.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="mb-4 flex justify-center">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Zap className="w-12 h-12 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Select an API endpoint</h3>
                <p className="text-muted-foreground">
                  Choose an endpoint from the sidebar to view its documentation and usage examples
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
