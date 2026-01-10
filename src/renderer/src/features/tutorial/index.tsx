import { BookOpen } from 'lucide-react';

const TutorialPage = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Documentation</h1>
          <p className="text-muted-foreground">Learn how to interact with the Elara API</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Get Accounts */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500">
              GET
            </span>
            <code className="text-sm font-mono text-muted-foreground">/accounts</code>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Retrieve a list of all configured AI accounts and their status.
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Response Example</h3>
              <pre className="p-4 rounded-lg bg-muted font-mono text-xs overflow-x-auto">
                {`[
  {
    "id": "acc_123",
    "name": "My ChatGPT",
    "provider": "openai",
    "isEnabled": true
  },
  {
    "id": "acc_456",
    "name": "DeepSeek Pro",
    "provider": "deepseek",
    "isEnabled": true
  }
]`}
              </pre>
            </div>
          </div>
        </div>

        {/* Chat Completions */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-500">
              POST
            </span>
            <code className="text-sm font-mono text-muted-foreground">/chat/completions</code>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Send a chat message to a specific account and get a response.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Request Body</h3>
              <pre className="p-4 rounded-lg bg-muted font-mono text-xs overflow-x-auto h-full">
                {`{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "account_id": "acc_123" // Optional
}`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Response Example</h3>
              <pre className="p-4 rounded-lg bg-muted font-mono text-xs overflow-x-auto h-full">
                {`{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello there! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialPage;
