# Chat History API Documentation

## Endpoints

### 1. Lấy danh sách Conversations

**URL:** `GET /v1/accounts/:accountId/conversations`

**Query Parameters:**
| Param  | Type     | Default | Mô tả |
|--------|----------|---------|-------|
| `limit`| `number` | `30`    | Số lượng conversations |

**Example Request:**
```bash
GET /v1/accounts/9b4ae913-fea2-4149-9a6f-e36a680f1a8e/conversations?limit=5
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Conversations retrieved successfully",
  "data": {
    "conversations": [...],
    "account": {
      "id": "...",
      "email": "...",
      "provider_id": "..."
    }
  },
  "meta": {
    "timestamp": "..."
  }
}
```

### 2. Lấy chi tiết Conversation

**URL:** `GET /v1/accounts/:accountId/conversations/:conversationId`

**Example Request:**
```bash
GET /v1/accounts/:accountId/conversations/4a6d953d-21d9-4df0-83e9-b38809894a2a
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Conversation details retrieved successfully",
  "data": {
    "conversation": { ... }
  },
  "meta": {
    "timestamp": "..."
  }
}
```

## Error Responses

### 404 - Account Not Found
```json
{
  "success": false,
  "message": "Account not found",
  "error": { "code": "NOT_FOUND" },
  "meta": { "timestamp": "..." }
}
```

### 500 - Provider Error
```json
{
  "success": false,
  "message": "Failed to fetch conversations: ...",
  "error": { "code": "PROVIDER_ERROR" },
  "meta": { "timestamp": "..." }
}
```

## Supported Providers

| Provider | List Conversations | Conversation Detail | Notes |
|----------|-------------------|-------------------|-------|
| **Claude** | ✅ Tested | ✅ Tested | Fully functional |
| **DeepSeek** | ✅ Implemented | ✅ Implemented | Ready to test |
| **Qwen** | ✅ Implemented | ⚠️ Not implemented | List only |
| **HuggingChat** | ✅ Implemented | ✅ Implemented | Ready to test |
| **Mistral** | ✅ Implemented | ⚠️ Not implemented | Parses HTML |
| **LMArena** | ✅ Implemented | ⚠️ Not implemented | List only |
| **Groq** | ❌ | ❌ | No persistent history API |
| **Gemini** | ❌ | ❌ | No persistent history API |

## Usage Example

```javascript
// Lấy danh sách conversations
const response = await fetch(
  'http://localhost:11434/v1/accounts/YOUR_ACCOUNT_ID/conversations?limit=10'
);
const data = await response.json();

if (data.success) {
  console.log(`Found ${data.data.conversations.length} conversations`);
}
```

## Provider-specific Response Formats

Mỗi provider trả về format khác nhau (giữ nguyên từ provider API):

### Claude
```json
{
  "uuid": "...",
  "name": "...",
  "model": "claude-haiku-4-5-20251001",
  "created_at": "2026-01-17T08:51:15.228574Z",
  ...
}
```

### DeepSeek
```json
{
  "data": [
    {
      "chat_session_id": "...",
      "chat_session_title": "...",
      ...
    }
  ]
}
```

### HuggingChat
```json
{
  "conversationId": "...",
  "title": "...",
  "model": "...",
  ...
}
```
