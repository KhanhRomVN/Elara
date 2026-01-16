import { ApiDocItem } from './ApiDocItem';

export const MessagingReference = () => {
  return (
    <div className="space-y-8 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Messaging API</h1>
        <p className="text-muted-foreground">
          APIs for sending chat completions through specific providers or accounts.
        </p>
      </div>

      <ApiDocItem
        method="POST"
        endpoint="/v1/chat/completions"
        description="Send a message using a specific provider and email account."
        reqHeader="Content-Type: application/json"
        reqBody={`{
  "model": "gpt-4",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": true
  // Query Parameters
  // ?provider=openai&email=user@example.com
}`}
        resBody={`{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [...]
}`}
      />

      <ApiDocItem
        method="POST"
        endpoint="/v1/chat/completions (Auto Email)"
        description="Send a message specifying only the provider. The system will automatically select an available account."
        reqHeader="Content-Type: application/json"
        reqBody={`{
  "model": "gpt-4",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": true
  // Query Parameters
  // ?provider=openai
}`}
        resBody={`{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [...]
}`}
      />
    </div>
  );
};
