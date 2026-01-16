import { useState } from 'react';
import { Code, Book, Database } from 'lucide-react';
import { CodeBlock } from '@renderer/core/components/CodeBlock';
import { cn } from '../../shared/lib/utils';
import { ProviderReference } from './components/ProviderReference';

interface APIEndpoint {
  path: string;
  method: string;
  owner: string;
  usedBy: string[];
  description: string;
  requestExample: string;
  requestHeaders: string;
  responseExample: string;
}

const apiEndpoints: APIEndpoint[] = [
  {
    path: '/v1/chat/completions',
    method: 'POST',
    owner: 'OpenAI',
    usedBy: [
      'Cursor IDE',
      'Continue.dev',
      'Cline',
      'Aider',
      'GitHub Copilot Chat',
      'ChatGPT Desktop',
      'ClaudeCode CLI (via proxy)',
      'Cody by Sourcegraph',
      'Tabnine',
      'Windsurf Editor',
    ],
    description:
      'OpenAI-compatible chat completions API. Standard de-facto cho AI coding assistants. Hỗ trợ streaming, function calling, và multi-turn conversations.',
    requestHeaders: `Authorization: Bearer sk-...\nContent-Type: application/json`,
    requestExample: `{
  "model": "gpt-4-turbo",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful coding assistant."
    },
    {
      "role": "user", 
      "content": "Write a function to reverse a string in Python"
    }
  ],
  "temperature": 0.7,
  "stream": true
}`,
    responseExample: `{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "def reverse_string(s):\\n    return s[::-1]"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 15,
    "total_tokens": 40
  }
}`,
  },
  {
    path: '/v1/completions',
    method: 'POST',
    owner: 'OpenAI',
    usedBy: ['GitHub Copilot', 'Tabnine', 'CodeWhisperer', 'Legacy coding tools'],
    description:
      'Legacy text completion API. Được dùng bởi older coding assistants. Đang dần được thay thế bởi /v1/chat/completions.',
    requestHeaders: `Authorization: Bearer sk-...\nContent-Type: application/json`,
    requestExample: `{
  "model": "gpt-3.5-turbo-instruct",
  "prompt": "def fibonacci(n):",
  "max_tokens": 100,
  "temperature": 0.5,
  "stop": ["\\n\\n"]
}`,
    responseExample: `{
  "id": "cmpl-123",
  "object": "text_completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo-instruct",
  "choices": [
    {
      "text": "\\n    if n <= 1:\\n        return n\\n    return fibonacci(n-1) + fibonacci(n-2)",
      "index": 0,
      "finish_reason": "stop"
    }
  ]
}`,
  },
  {
    path: '/v1/messages',
    method: 'POST',
    owner: 'Anthropic',
    usedBy: [
      'ClaudeCode CLI',
      'Claude Desktop',
      'Cursor (Claude mode)',
      'Continue.dev (Claude)',
      'Cline',
      'Windsurf (Claude)',
    ],
    description:
      'Anthropic Claude Messages API. Tối ưu cho long-context coding tasks. Hỗ trợ 200K tokens context window.',
    requestHeaders: `x-api-key: sk-ant-...\nanthropic-version: 2023-06-01\ncontent-type: application/json`,
    requestExample: `{
  "model": "claude-3-opus-20240229",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "Explain this code: def foo(x): return x ** 2"
    }
  ],
  "system": "You are a code reviewer."
}`,
    responseExample: `{
  "id": "msg_123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "This function squares the input value x..."
    }
  ],
  "model": "claude-3-opus-20240229",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 20,
    "output_tokens": 50
  }
}`,
  },
  {
    path: '/v1beta/models/:model:generateContent',
    method: 'POST',
    owner: 'Google (Gemini)',
    usedBy: ['Google AI Studio', 'Gemini Code Assist', 'Cursor (Gemini)', 'IDX Editor'],
    description:
      'Google Gemini generation API. Hỗ trợ multimodal (text + images + video). Tốt cho code understanding với visual context.',
    requestHeaders: `Content-Type: application/json`,
    requestExample: `{
  "contents": [
    {
      "parts": [
        {
          "text": "Generate a React component for a button"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.9,
    "maxOutputTokens": 2048
  }
}`,
    responseExample: `{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "function Button({ label, onClick }) {\\n  return <button onClick={onClick}>{label}</button>\\n}"
          }
        ]
      },
      "finishReason": "STOP"
    }
  ]
}`,
  },
  {
    path: '/v1/models',
    method: 'GET',
    owner: 'OpenAI',
    usedBy: [
      'Cursor',
      'Continue.dev',
      'Cline',
      'OpenAI Playground',
      'Tất cả OpenAI-compatible tools',
    ],
    description:
      'List available models. Được gọi khi user chọn model trong IDE. Returns danh sách models với metadata.',
    requestHeaders: `Authorization: Bearer sk-...`,
    requestExample: `GET /v1/models`,
    responseExample: `{
  "object": "list",
  "data": [
    {
      "id": "gpt-4-turbo",
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai"
    },
    {
      "id": "gpt-3.5-turbo",
      "object": "model", 
      "created": 1677649963,
      "owned_by": "openai"
    }
  ]
}`,
  },
  {
    path: '/api/generate',
    method: 'POST',
    owner: 'Ollama',
    usedBy: ['Continue.dev (local)', 'Open WebUI', 'Ollama CLI', 'Local coding assistants'],
    description:
      'Ollama local generation API. Cho running models locally (Llama, CodeLlama, DeepSeek Coder...). Privacy-first.',
    requestHeaders: `Content-Type: application/json`,
    requestExample: `{
  "model": "codellama:13b",
  "prompt": "Write a sorting algorithm in Rust",
  "stream": true
}`,
    responseExample: `{
  "model": "codellama:13b",
  "created_at": "2024-01-14T10:00:00Z",
  "response": "fn bubble_sort<T: Ord>(arr: &mut [T]) {...}",
  "done": false
}`,
  },
  {
    path: '/v1/engines/:engine/completions',
    method: 'POST',
    owner: 'OpenAI (Legacy)',
    usedBy: ['Old GitHub Copilot', 'Legacy integrations'],
    description: 'Deprecated OpenAI Engines API. Replaced by /v1/completions.',
    requestHeaders: `Authorization: Bearer sk-...\nContent-Type: application/json`,
    requestExample: `{
  "prompt": "const sum = (a, b) =>",
  "max_tokens": 50
}`,
    responseExample: `{
  "choices": [
    {
      "text": " a + b;",
      "index": 0,
      "finish_reason": "stop"
    }
  ]
}`,
  },
  {
    path: '/api/chat',
    method: 'POST',
    owner: 'Ollama',
    usedBy: ['Continue.dev', 'Open WebUI', 'Ollama CLI'],
    description:
      'Ollama chat API with conversation history. OpenAI-compatible format cho local models.',
    requestHeaders: `Content-Type: application/json`,
    requestExample: `{
  "model": "deepseek-coder:33b",
  "messages": [
    {
      "role": "user",
      "content": "Explain async/await in JavaScript"
    }
  ]
}`,
    responseExample: `{
  "model": "deepseek-coder:33b",
  "created_at": "2024-01-14T10:00:00Z",
  "message": {
    "role": "assistant",
    "content": "Async/await is syntactic sugar for Promises..."
  }
}`,
  },
];

export default function TutorialPage() {
  const [activeSection, setActiveSection] = useState<'endpoints' | 'providers'>('endpoints');

  return (
    <div className="h-full flex flex-col bg-background p-4 gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tutorial</h2>
        <p className="text-muted-foreground">
          Reference for supported API endpoints and coding tools.
        </p>
      </div>

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex overflow-hidden border border-dashed border-zinc-500/25 rounded-lg relative">
        {/* Left Sidebar */}
        <div className="w-64 border-r bg-card p-4 overflow-y-auto hidden md:block space-y-2">
          <button
            onClick={() => setActiveSection('endpoints')}
            className={cn(
              'w-full p-2 text-left hover:bg-muted/50 rounded-md transition-colors flex items-center gap-2',
              activeSection === 'endpoints' ? 'bg-muted/50 text-primary' : 'text-muted-foreground',
            )}
          >
            <Book className="w-4 h-4" />
            <span className="font-medium">Getting Started</span>
          </button>

          <button
            onClick={() => setActiveSection('providers')}
            className={cn(
              'w-full p-2 text-left hover:bg-muted/50 rounded-md transition-colors flex items-center gap-2',
              activeSection === 'providers' ? 'bg-muted/50 text-primary' : 'text-muted-foreground',
            )}
          >
            <Database className="w-4 h-4" />
            <span className="font-medium">Provider API Reference</span>
          </button>
        </div>

        {/* Center Content + Right Sidebar */}
        <div className="flex-1 flex overflow-hidden bg-background">
          {activeSection === 'providers' ? (
            <div className="flex-1 overflow-y-auto scroll-smooth">
              <ProviderReference />
            </div>
          ) : (
            <>
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold mb-2">API Endpoints Reference</h1>
                  <p className="text-muted-foreground">
                    Danh sách API được sử dụng bởi các coding tools phổ biến
                  </p>
                </div>

                {/* API Endpoints List */}
                <div className="space-y-8">
                  {apiEndpoints.map((endpoint) => (
                    <div
                      key={endpoint.path}
                      id={endpoint.path}
                      className="scroll-mt-6 rounded-lg border bg-card p-6"
                    >
                      {/* Header */}
                      <div className="mb-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className={`px-3 py-1 rounded text-sm font-mono font-semibold ${
                              endpoint.method === 'POST'
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-blue-500/20 text-blue-500'
                            }`}
                          >
                            {endpoint.method}
                          </span>
                          <code className="text-xl font-mono">{endpoint.path}</code>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Code className="h-4 w-4" />
                            <span>Owner: {endpoint.owner}</span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-4">
                        <p className="text-muted-foreground">{endpoint.description}</p>
                      </div>

                      {/* Used By */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold mb-2">Được sử dụng bởi:</h4>
                        <div className="flex flex-wrap gap-2">
                          {endpoint.usedBy.map((tool) => (
                            <span
                              key={tool}
                              className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Request & Response Examples - Side by Side */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {/* Request Headers - Full Width on Mobile, Cell on XL */}
                        <div className="xl:col-span-2">
                          <h4 className="text-sm font-semibold mb-2">Request Headers</h4>
                          <CodeBlock
                            code={endpoint.requestHeaders}
                            language="yaml"
                            maxLines={10}
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
                              selectionHighlight: false,
                              occurrencesHighlight: false,
                              hover: { enabled: false },
                            }}
                          />
                        </div>

                        {/* Request */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Request Body</h4>
                          <CodeBlock
                            code={endpoint.requestExample}
                            language="json"
                            maxLines={25}
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
                              selectionHighlight: false,
                              occurrencesHighlight: false,
                              hover: { enabled: false },
                            }}
                          />
                        </div>

                        {/* Response */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Response Example</h4>
                          <CodeBlock
                            code={endpoint.responseExample}
                            language="json"
                            maxLines={25}
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
                              selectionHighlight: false,
                              occurrencesHighlight: false,
                              hover: { enabled: false },
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Note */}
                <div className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-6">
                  <h4 className="font-semibold mb-2">💡 Elara Integration</h4>
                  <p className="text-sm text-muted-foreground">
                    Elara proxy hỗ trợ tất cả các endpoints trên với multi-account load balancing.
                    Bạn có thể sử dụng các endpoints này với bất kỳ tool nào được liệt kê thông qua
                    proxy server của Elara.
                  </p>
                </div>
              </div>

              {/* Right Sidebar (TOC) - Only for Endpoints */}
              <div className="w-64 border-l bg-card p-4 overflow-y-auto hidden xl:block">
                <h3 className="font-semibold mb-4 text-sm text-muted-foreground">ON THIS PAGE</h3>
                <div className="flex flex-col gap-2">
                  {apiEndpoints.map((endpoint) => (
                    <a
                      key={endpoint.path}
                      href={`#${endpoint.path}`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate block py-1"
                      title={endpoint.path}
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById(endpoint.path)
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      {endpoint.path}
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
