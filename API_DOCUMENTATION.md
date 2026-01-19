# Elara API Documentation

> Comprehensive guide to Elara's embedded server APIs

## 📚 Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Account Management](#account-management)
- [Models](#models)
- [Conversation Management](#conversation-management)
- [Chat & Messaging](#chat--messaging)

---

## Overview

Elara's embedded server provides a local REST API running on your machine. This API enables powerful integrations with AI providers, account management, conversation history, and real-time messaging capabilities.

## Base URL

```
http://localhost:11434
```

The embedded server runs on port `11434` by default. All endpoints are prefixed with `/v1`.

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    /* response data */
  },
  "meta": {
    "timestamp": "2026-01-19T00:00:00.000Z"
  }
}
```

### Success Response

- `success` (boolean): Indicates if the request was successful
- `message` (string): Human-readable message describing the result
- `data` (object/array): The actual response payload
- `meta` (object): Metadata about the request/response

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "meta": {
    "timestamp": "2026-01-19T00:00:00.000Z"
  }
}
```

---

## Account Management

### Get All Accounts

Retrieve all accounts with optional filtering and pagination.

**Endpoint:** `GET /v1/accounts`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number for pagination (default: 1) |
| `limit` | number | No | Items per page (default: 10) |
| `provider_id` | string | No | Filter by provider (e.g., "deepseek", "claude") |

**Example Request:**

```bash
curl "http://localhost:11434/v1/accounts?page=1&limit=10&provider_id=deepseek"
```

**Response:**

```json
{
  "success": true,
  "message": "Accounts retrieved successfully",
  "data": [
    {
      "id": "acc_123456",
      "email": "user@example.com",
      "provider_id": "deepseek",
      "credential": {
        "cookie": "...",
        "jwt": "..."
      },
      "created_at": "2026-01-19T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-01-19T00:00:00.000Z",
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
```

---

### Delete Account

Delete an account by its ID.

**Endpoint:** `DELETE /v1/accounts/:id`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Account ID to delete |

**Example Request:**

```bash
curl -X DELETE "http://localhost:11434/v1/accounts/acc_123456"
```

**Response:**

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "meta": {
    "timestamp": "2026-01-19T00:00:00.000Z"
  }
}
```

---

### Import Accounts

Bulk import multiple accounts at once.

**Endpoint:** `POST /v1/accounts/import`

**Request Body:**

```json
{
  "accounts": [
    {
      "email": "user1@example.com",
      "provider_id": "DeepSeek",
      "credential": {
        "cookie": "session=...",
        "jwt": "eyJ..."
      }
    }
  ]
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accounts` | array | Yes | Array of account objects to import |
| `accounts[].email` | string | Yes | Account email address |
| `accounts[].provider_id` | string | Yes | Provider identifier |
| `accounts[].credential` | object | Yes | Authentication credentials |
| `accounts[].credential.cookie` | string | No | Session cookie |
| `accounts[].credential.jwt` | string | No | JWT token |

**Response:**

```json
{
  "success": true,
  "message": "Accounts imported successfully",
  "data": {
    "imported": 2,
    "failed": 0
  }
}
```

---

## Models

### Get Provider Models

Get available models for a specific provider (unified endpoint).

**Endpoint:** `GET /v1/providers/:providerId/models`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `providerId` | string | Yes | Provider identifier (e.g., "deepseek", "claude", "groq") |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | No | Required only for dynamic providers (Groq, Antigravity, HuggingChat, etc.) |

**Example Request:**

```bash
# Static provider (DeepSeek, Claude)
curl "http://localhost:11434/v1/providers/deepseek/models"

# Dynamic provider (Groq, requires email)
curl "http://localhost:11434/v1/providers/groq/models?email=user@example.com"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "deepseek-chat",
      "name": "DeepSeek Chat"
    },
    {
      "id": "deepseek-reasoner",
      "name": "DeepSeek Reasoner"
    }
  ],
  "source": "static"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `data` | array | Array of model objects |
| `data[].id` | string | Model identifier |
| `data[].name` | string | Model display name |
| `source` | string | Data source: "static" (hardcoded) or "dynamic" (from API) |

---

### Get All Models from Enabled Providers

Get all available models from providers that are currently enabled.

**Endpoint:** `GET /v1/models/all`

**Query Parameters:** None

**Example Request:**

```bash
curl "http://localhost:11434/v1/models/all"
```

**Response:**

```json
{
  "success": true,
  "message": "Models retrieved successfully",
  "data": [
    {
      "id": "deepseek-chat",
      "name": "DeepSeek Chat",
      "provider_id": "deepseek",
      "provider_name": "DeepSeek"
    },
    {
      "id": "deepseek-reasoner",
      "name": "DeepSeek Reasoner",
      "provider_id": "deepseek",
      "provider_name": "DeepSeek"
    },
    {
      "id": "claude-sonnet-4-5-20250929",
      "name": "Claude Sonnet 4.5",
      "provider_id": "claude",
      "provider_name": "Claude"
    },
    {
      "id": "claude-haiku-4-5-20251001",
      "name": "Claude Haiku 4.5",
      "provider_id": "claude",
      "provider_name": "Claude"
    }
  ],
  "meta": {
    "timestamp": "2026-01-19T01:48:00.000Z",
    "total": 4
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `message` | string | Human-readable message |
| `data` | array | Array of model objects from enabled providers |
| `data[].id` | string | Model identifier |
| `data[].name` | string | Model display name |
| `data[].provider_id` | string | Provider identifier |
| `data[].provider_name` | string | Provider display name |
| `meta.timestamp` | string | Response timestamp |
| `meta.total` | number | Total number of models returned |

**Notes:**

- Only returns models from providers where `is_enabled = true`
- Providers with `is_enabled = false` are automatically filtered out
- Only includes static models defined in `provider.json`
- Results are cached for 5 minutes for performance

## Conversation Management

### Get Conversation History

Retrieve conversation history for a specific account.

**Endpoint:** `GET /v1/accounts/:accountId/conversations`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | Account ID from path parameter |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Number of conversations to return (default: 30) |
| `page` | number | No | Page number for pagination (default: 1) |

**Example Request:**

```bash
curl "http://localhost:11434/v1/accounts/acc_123456/conversations?limit=30&page=1"
```

**Response:**

```json
{
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
      "provider_id": "DeepSeek"
    }
  }
}
```

---

### Get Conversation Details

Get detailed information about a specific conversation including all messages.

**Endpoint:** `GET /v1/accounts/:accountId/conversations/:conversationId`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | Account ID from path |
| `conversationId` | string | Yes | Conversation ID from path |

**Example Request:**

```bash
curl "http://localhost:11434/v1/accounts/acc_123456/conversations/conv_123"
```

**Response:**

```json
{
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
}
```

---

## Chat & Messaging

### Send Message

Send a message to a specific account with optional streaming support.

**Endpoint:** `POST /v1/chat/accounts/:accountId/messages`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | Account ID from path parameter |

**Request Body:**

```json
{
  "model": "deepseek-chat",
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
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model identifier to use |
| `messages` | array | Yes | Array of message objects |
| `messages[].role` | string | Yes | Message role ("user" or "assistant") |
| `messages[].content` | string | Yes | Message content |
| `conversationId` | string | No | Existing conversation ID (creates new if omitted) |
| `stream` | boolean | No | Enable streaming response (default: true) |
| `search` | boolean | No | Enable web search capabilities |
| `ref_file_ids` | array | No | Array of referenced file IDs |

**Streaming Response (SSE format):**

```
data: {"content":"Hello"}
data: {"content":"! I'm"}
data: {"content":" doing"}
data: {"content":" well"}
data: {"meta":{"conversationId":"conv_123"}}
data: [DONE]
```

**Non-streaming Response:**

```json
{
  "success": true,
  "message": {
    "role": "assistant",
    "content": "Hello! I'm doing well."
  },
  "metadata": {
    "conversationId": "conv_123",
    "model": "deepseek-chat"
  }
}
```

**Example Request:**

```bash
# Non-streaming
curl -X POST "http://localhost:11434/v1/chat/accounts/acc_123456/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# Streaming
curl -X POST "http://localhost:11434/v1/chat/accounts/acc_123456/messages" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

---

### Upload File

Upload a file for use in chat conversations.

**Endpoint:** `POST /v1/chat/accounts/:accountId/uploads`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | Account ID from path parameter |

**Request:**

```
Content-Type: multipart/form-data

file: [binary file data]
```

**Response:**

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file_id": "file_abc123",
    "filename": "document.pdf",
    "size": 1024000,
    "mime_type": "application/pdf",
    "url": "http://localhost:11434/uploads/file_abc123"
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Upload success status |
| `data.file_id` | string | Unique file identifier |
| `data.filename` | string | Original filename |
| `data.size` | number | File size in bytes |
| `data.mime_type` | string | File MIME type |
| `data.url` | string | File access URL |

**Example Request:**

```bash
curl -X POST "http://localhost:11434/v1/chat/accounts/acc_123456/uploads" \
  -F "file=@document.pdf"
```

---

## Need Help?

For more information or support:

- Check the [main README](README.md)
- Open an issue on [GitHub](https://github.com/KhanhRomVN/Elara/issues)
- Visit the Tutorial page in the Elara app

---

<p align="center">
  Made with ❤️ by KhanhRomVN
</p>
