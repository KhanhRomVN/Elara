# CLIProxyAPI - Giải Thích Chi Tiết Toàn Bộ API

## Tổng Quan

CLIProxyAPI là một **proxy server** cho phép bạn sử dụng nhiều AI providers (OpenAI, Claude, Gemini...) thông qua **một HTTPS endpoint duy nhất**. Nó hỗ trợ:

- Multi-account load balancing
- OAuth authentication (không cần API keys)
- OpenAI-compatible API
- Provider-specific APIs

---

## 1. OpenAI-Compatible API (`/v1/*`)

### 1.1. Chat Completions

```
POST /v1/chat/completions
```

**Mục đích:** Send chat messages và nhận responses

**Request Body:**

```json
{
  "model": "gemini-pro",
  "messages": [{ "role": "user", "content": "Hello!" }],
  "stream": true,
  "temperature": 0.7
}
```

**Đặc biệt:**

- Tự động route tới provider phù hợp dựa trên model name
- Hỗ trợ streaming (SSE)
- Load balance qua nhiều accounts
- Hỗ trợ tất cả providers: OpenAI, Claude, Gemini, Qwen, iFlow...

**Response:** Stream SSE hoặc JSON response theo OpenAI format

---

### 1.2. Text Completions

```
POST /v1/completions
```

**Mục đích:** Legacy text completion API

**Request Body:**

```json
{
  "model": "gpt-3.5-turbo",
  "prompt": "Once upon a time",
  "max_tokens": 100
}
```

---

### 1.3. List Models

```
GET /v1/models
```

**Mục đích:** Lấy danh sách tất cả models từ **tất cả active accounts**

**Response:**

```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini-pro",
      "object": "model",
      "created": 1234567890,
      "owned_by": "google"
    },
    {
      "id": "claude-3-opus",
      "object": "model",
      "owned_by": "anthropic"
    }
  ]
}
```

**Đặc biệt:**

- Aggregate models từ **tất cả** accounts đã configure
- Bao gồm: Gemini CLI, AI Studio, Claude Code, OpenAI Codex, Qwen, iFlow...

---

### 1.4. Messages (Claude)

```
POST /v1/messages
POST /v1/messages/count_tokens
```

**Mục đích:** Claude-specific API

**Request Body:**

```json
{
  "model": "claude-3-opus",
  "messages": [{ "role": "user", "content": "Hello Claude!" }]
}
```

**Routing:**

- Nếu User-Agent bắt đầu với `"claude-cli"` → route tới Claude handler
- Tương thích 100% với Anthropic API

---

### 1.5. Responses (OpenAI)

```
POST /v1/responses
```

**Mục đích:** OpenAI Responses API (phản hồi tự động)

---

## 2. Gemini API (`/v1beta/*`)

### 2.1. List Gemini Models

```
GET /v1beta/models
```

**Mục đích:** Lấy danh sách models từ Gemini accounts

**Response:**

```json
{
  "models": [
    {
      "name": "models/gemini-pro",
      "displayName": "Gemini Pro",
      "supportedGenerationMethods": ["generateContent"]
    }
  ]
}
```

---

### 2.2. Generate Content

```
POST /v1beta/models/{model}:generateContent
GET  /v1beta/models/{model}:generateContent
```

**Mục đích:** Gemini-specific generation API

**Request Body:**

```json
{
  "contents": [
    {
      "parts": [{ "text": "Hello Gemini!" }]
    }
  ],
  "generationConfig": {
    "temperature": 0.7
  }
}
```

**Hỗ trợ:**

- Streaming
- Multimodal (text + images)
- Function calling

---

### 2.3. Get Model Info

```
GET /v1beta/models/{model}
```

**Mục đích:** Lấy thông tin chi tiết về 1 model cụ thể

---

## 3. Gemini CLI Internal

```
POST /v1internal:method
```

**Mục đích:** Protocol nội bộ của Gemini CLI

**Sử dụng bởi:** Google Gemini CLI official tool

---

## 4. Management API (`/v0/management/*`)

### 4.1. Configuration

#### Get Configuration

```
GET /v0/management/config
```

**Response:**

```json
{
  "host": "127.0.0.1",
  "port": 8317,
  "tls": { "enable": false },
  "api-keys": ["key1", "key2"],
  "routing": { "strategy": "round-robin" }
}
```

---

#### Get Config YAML

```
GET /v0/management/config.yaml
```

**Response:** Raw YAML config file

---

#### Update Config YAML

```
PUT /v0/management/config.yaml
```

**Request Body:** Raw YAML content

**Mục đích:** Update và hot-reload config

---

### 4.2. Usage Statistics

#### Get Usage Stats

```
GET /v0/management/usage
```

**Response:**

```json
{
  "total_requests": 1234,
  "total_tokens": 567890,
  "by_provider": {
    "gemini-cli": { "requests": 500, "tokens": 200000 },
    "claude": { "requests": 734, "tokens": 367890 }
  }
}
```

---

#### Export Usage

```
GET /v0/management/usage/export
```

**Response:** CSV hoặc JSON file để download

---

#### Import Usage

```
POST /v0/management/usage/import
```

**Mục đích:** Import usage data từ backup

---

### 4.3. Logs

#### Get Logs

```
GET /v0/management/logs
```

**Query params:**

- `limit`: số lượng logs
- `level`: error/warn/info

**Response:** Array of log entries

---

#### Delete Logs

```
DELETE /v0/management/logs
```

**Mục đích:** Xóa old logs

---

#### Get Request Error Logs

```
GET /v0/management/request-error-logs
GET /v0/management/request-error-logs/:name
```

**Mục đích:** Lấy logs của failed requests

---

#### Get Request Log by ID

```
GET /v0/management/request-log-by-id/:id
GET /v0/management/request-log
```

**Mục đích:** Xem chi tiết request/response logs

---

### 4.4. Debug & Settings

#### Debug Mode

```
GET  /v0/management/debug
PUT  /v0/management/debug
PATCH /v0/management/debug
```

**Request Body:**

```json
{ "enabled": true }
```

---

#### Logging to File

```
GET  /v0/management/logging-to-file
PUT  /v0/management/logging-to-file
```

---

#### Logs Max Size

```
GET  /v0/management/logs-max-total-size-mb
PUT  /v0/management/logs-max-total-size-mb
```

---

#### Usage Statistics Enabled

```
GET  /v0/management/usage-statistics-enabled
PUT  /v0/management/usage-statistics-enabled
```

---

#### Proxy URL

```
GET    /v0/management/proxy-url
PUT    /v0/management/proxy-url
DELETE /v0/management/proxy-url
```

**Mục đích:** Configure HTTP/SOCKS5 proxy cho outbound requests

---

#### Quota Exceeded Settings

```
GET  /v0/management/quota-exceeded/switch-project
PUT  /v0/management/quota-exceeded/switch-project

GET  /v0/management/quota-exceeded/switch-preview-model
PUT  /v0/management/quota-exceeded/switch-preview-model
```

**Mục đích:** Tự động switch khi quota hết

---

#### Routing Strategy

```
GET  /v0/management/routing/strategy
PUT  /v0/management/routing/strategy
```

**Values:** `round-robin`, `fill-first`

---

### 4.5. API Keys Management

```
GET    /v0/management/api-keys
PUT    /v0/management/api-keys
PATCH  /v0/management/api-keys
DELETE /v0/management/api-keys
```

**Mục đích:** Manage API keys để authenticate requests

---

### 4.6. Provider Keys Management

#### Gemini API Keys

```
GET    /v0/management/gemini-api-key
PUT    /v0/management/gemini-api-key
PATCH  /v0/management/gemini-api-key
DELETE /v0/management/gemini-api-key
```

**Request Body:**

```json
{
  "api-key": "AIzaSy...",
  "prefix": "project1",
  "base-url": "https://generativelanguage.googleapis.com",
  "models": [{ "name": "gemini-2.5-flash", "alias": "flash" }]
}
```

---

#### Claude API Keys

```
GET    /v0/management/claude-api-key
PUT    /v0/management/claude-api-key
PATCH  /v0/management/claude-api-key
DELETE /v0/management/claude-api-key
```

---

#### Codex API Keys

```
GET    /v0/management/codex-api-key
PUT    /v0/management/codex-api-key
PATCH  /v0/management/codex-api-key
DELETE /v0/management/codex-api-key
```

---

#### OpenAI Compatibility Providers

```
GET    /v0/management/openai-compatibility
PUT    /v0/management/openai-compatibility
PATCH  /v0/management/openai-compatibility
DELETE /v0/management/openai-compatibility
```

**Mục đích:** Add custom OpenAI-compatible providers (e.g., OpenRouter)

**Example:**

```json
{
  "name": "openrouter",
  "base-url": "https://openrouter.ai/api/v1",
  "api-key-entries": [{ "api-key": "sk-or-v1-..." }],
  "models": [{ "name": "openai/gpt-4", "alias": "gpt4" }]
}
```

---

#### Vertex API Keys

```
GET    /v0/management/vertex-api-key
PUT    /v0/management/vertex-api-key
PATCH  /v0/management/vertex-api-key
DELETE /v0/management/vertex-api-key
```

---

### 4.7. OAuth Excluded Models

```
GET    /v0/management/oauth-excluded-models
PUT    /v0/management/oauth-excluded-models
PATCH  /v0/management/oauth-excluded-models
DELETE /v0/management/oauth-excluded-models
```

**Mục đích:** Exclude models khỏi OAuth accounts

**Example:**

```json
{
  "gemini-cli": ["gemini-2.5-pro"],
  "claude": ["claude-3-5-haiku-*"]
}
```

---

### 4.8. OAuth Model Mappings

```
GET    /v0/management/oauth-model-mappings
PUT    /v0/management/oauth-model-mappings
PATCH  /v0/management/oauth-model-mappings
DELETE /v0/management/oauth-model-mappings
```

**Mục đích:** Rename model IDs cho OAuth accounts

**Example:**

```json
{
  "gemini-cli": [{ "name": "gemini-2.5-pro", "alias": "g2.5p" }]
}
```

---

### 4.9. Auth Files Management

#### List Auth Files

```
GET /v0/management/auth-files
```

**Response:**

```json
{
  "files": [
    {
      "name": "gemini-cli-account1.json",
      "provider": "gemini-cli",
      "created": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### Get Auth File Models

```
GET /v0/management/auth-files/models
```

**Query:** `?file=gemini-cli-account1.json`

**Response:** List models available cho account này

---

#### Download Auth File

```
GET /v0/management/auth-files/download
```

**Query:** `?file=gemini-cli-account1.json`

**Response:** JSON file download

---

#### Upload Auth File

```
POST /v0/management/auth-files
```

**Request:** Multipart form upload

**Mục đích:** Backup/restore accounts

---

#### Delete Auth File

```
DELETE /v0/management/auth-files
```

**Query:** `?file=gemini-cli-account1.json`

---

#### Import Vertex Credential

```
POST /v0/management/vertex/import
```

**Request:** Upload Google Cloud service account JSON

---

### 4.10. OAuth Authentication URLs

#### Gemini CLI Auth

```
GET /v0/management/gemini-cli-auth-url
```

**Response:**

```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/auth?...",
  "state": "session-id-123"
}
```

**Flow:**

1. UI gọi endpoint này
2. Mở browser với `auth_url`
3. User login Google
4. Google redirect về `/google/callback?code=xxx&state=session-id-123`
5. Server exchange code → tokens
6. Save vào `~/.cli-proxy-api/gemini-cli-*.json`

---

#### Codex Auth (OpenAI)

```
GET /v0/management/codex-auth-url
```

**Flow tương tự Gemini CLI**

---

#### Anthropic Auth (Claude Code)

```
GET /v0/management/anthropic-auth-url
```

**Flow tương tự Gemini CLI**

---

#### Antigravity Auth

```
GET /v0/management/antigravity-auth-url
```

---

#### Qwen Auth

```
GET /v0/management/qwen-auth-url
```

---

#### iFlow Auth

```
GET /v0/management/iflow-auth-url
POST /v0/management/iflow-auth-url
```

**POST:** iFlow có thể dùng cookie authentication

---

#### OAuth Callback

```
POST /v0/management/oauth-callback
```

**Mục đích:** Manual callback submit (alternative flow)

---

#### Get Auth Status

```
GET /v0/management/get-auth-status
```

**Query:** `?state=session-id-123`

**Response:**

```json
{
  "status": "completed",
  "account_file": "gemini-cli-account1.json"
}
```

**Sử dụng:** Polling để check xem OAuth flow đã hoàn thành chưa

---

### 4.11. WebSocket Auth

```
GET  /v0/management/ws-auth
PUT  /v0/management/ws-auth
```

**Mục đích:** Enable/disable auth cho WebSocket endpoint

---

### 4.12. Amp Code Integration

```
GET    /v0/management/ampcode
GET    /v0/management/ampcode/upstream-url
PUT    /v0/management/ampcode/upstream-url
DELETE /v0/management/ampcode/upstream-url

GET    /v0/management/ampcode/upstream-api-key
PUT    /v0/management/ampcode/upstream-api-key
DELETE /v0/management/ampcode/upstream-api-key

GET    /v0/management/ampcode/restrict-management-to-localhost
PUT    /v0/management/ampcode/restrict-management-to-localhost

GET    /v0/management/ampcode/model-mappings
PUT    /v0/management/ampcode/model-mappings
PATCH  /v0/management/ampcode/model-mappings
DELETE /v0/management/ampcode/model-mappings

GET    /v0/management/ampcode/force-model-mappings
PUT    /v0/management/ampcode/force-model-mappings

GET    /v0/management/ampcode/upstream-api-keys
PUT    /v0/management/ampcode/upstream-api-keys
PATCH  /v0/management/ampcode/upstream-api-keys
DELETE /v0/management/ampcode/upstream-api-keys
```

**Mục đích:** Integration với Amp CLI tool

---

### 4.13. Request Retry

```
GET  /v0/management/request-retry
PUT  /v0/management/request-retry

GET  /v0/management/max-retry-interval
PUT  /v0/management/max-retry-interval
```

---

### 4.14. Force Model Prefix

```
GET  /v0/management/force-model-prefix
PUT  /v0/management/force-model-prefix
```

**Mục đích:** Force user phải dùng prefix (e.g., `project1/gemini-pro`)

---

### 4.15. API Call Testing

```
POST /v0/management/api-call
```

**Request Body:**

```json
{
  "provider": "gemini-cli",
  "endpoint": "/v1/models",
  "method": "GET"
}
```

**Mục đích:** Test API calls từ management UI

---

### 4.16. Latest Version Check

```
GET /v0/management/latest-version
```

**Response:**

```json
{
  "current": "v6.0.0",
  "latest": "v6.1.0",
  "update_available": true
}
```

---

## 5. OAuth Callback Endpoints

### 5.1. Anthropic Callback

```
GET /anthropic/callback?code=xxx&state=yyy
```

---

### 5.2. Codex Callback

```
GET /codex/callback?code=xxx&state=yyy
```

---

### 5.3. Google Callback

```
GET /google/callback?code=xxx&state=yyy
```

---

### 5.4. iFlow Callback

```
GET /iflow/callback?code=xxx&state=yyy
```

---

### 5.5. Antigravity Callback

```
GET /antigravity/callback?code=xxx&state=yyy
```

**Mục đích:** Nhận OAuth callback từ provider, extract `code`, exchange sang tokens, save vào file

---

## 6. Management Control Panel

```
GET /management.html
```

**Mục đích:** Web UI để manage proxy

**Features:**

- View/edit configuration
- Manage accounts
- View usage statistics
- Initiate OAuth flows
- Test API calls

---

## Tổng Kết

### Nhóm API chính:

1. **User-facing APIs** (`/v1/*`, `/v1beta/*`)
   - Chat với AI models
   - OpenAI-compatible
   - Provider-specific formats

2. **Management APIs** (`/v0/management/*`)
   - Configuration
   - Account management
   - Statistics & logs
   - OAuth authentication

3. **OAuth Callbacks**
   - Nhận tokens từ providers
   - Auto-save credentials

### Điểm mạnh:

✅ **Unified endpoint** - 1 URL cho tất cả providers  
✅ **Multi-account load balancing** - Round-robin, fill-first  
✅ **OAuth support** - Không cần API keys  
✅ **Hot-reload** - Update config không cần restart  
✅ **Model aliasing** - Rename models  
✅ **Quota auto-switch** - Tự chuyển account khi hết quota  
✅ **OpenAI-compatible** - Dùng được với mọi OpenAI client/SDK

### Elara có thể áp dụng:

- Implement tương tự management API structure
- Sử dụng OAuth flow pattern
- Multi-account routing với load balancing strategies
- Configuration hot-reload
- Model aliasing & exclusion
