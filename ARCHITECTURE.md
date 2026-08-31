# Elara Server - Kiến Trúc & Tài Liệu Chức Năng

Tài liệu mô tả toàn bộ chức năng của các file trong `server/src/`, tổ chức theo cấu trúc thư mục. Các provider không phải DeepSeek bị bỏ qua theo yêu cầu.

---

## 1. CORE (Thư mục gốc `server/src/`)

### `app.ts`
**Tạo và cấu hình Express application.**
- Khởi tạo Express app với CORS, JSON parser (limit 50MB).
- Load tất cả providers qua `providerRegistry.loadProviders()`.
- Khởi động `versionService` để kiểm tra phiên bản.
- Đăng ký middleware: `versionMiddleware`, `requestLogger`, `errorHandler`.
- Định nghĩa route:
  - `GET /health` — health check.
  - `POST /v1` — tất cả API v1 routes.
  - `POST /login/:provider` — login qua browser (dùng chung controller `account.controller`).
  - `POST /api/event_logging/batch` — stub nhận event log, luôn trả 200.
- Fallback 404 handler và error handler.

### `env.ts`
**Load biến môi trường từ file `.env` gốc của dự án.**
- Sử dụng `dotenv`, resolve path tới `../../.env` từ `__dirname`.

### `index.ts`
**Entry point chính của server (CLI & programmatic).**
- Set DNS mặc định thành `ipv4first`.
- Gọi `initDatabase()` với optional `--db-path` từ CLI args.
- Gọi `startServer()` để khởi động HTTP/HTTPS server.
- Sau khi start thành công, khởi động `accountRefreshService` (tự động refresh token, usage).
- Export `startBackend` cho programmatic use.
- Xử lý graceful shutdown (`SIGTERM`, `SIGINT`).

### `server.ts`
**Quản lý HTTP/HTTPS server lifecycle.**
- `startServer()`: Tạo HTTP hoặc HTTPS server (dựa trên TLS config), lắng nghe trên port từ `getServerConfig()`.
- `stopServer()`: Đóng server đang chạy.
- `getServerInfo()`: Trả về trạng thái server (running, port, host, https).
- Xử lý lỗi `EADDRINUSE` (port đã bị chiếm).

---

## 2. CONFIG (`server/src/config/`)

### `proxy.config.ts`
**Cấu hình cho Elara Proxy (MITM proxy).**
- `ProxyConfig` interface: host, port (default 8317), TLS, apiKeys, routing strategy (round-robin/priority/least-used), CORS, localhostOnly.
- `ConfigManager` class: Load/save config từ `~/.elara/proxy-config.json`, hỗ trợ reset về default.
- Singleton pattern với `getConfigManager()`, `getProxyConfig()`, `updateProxyConfig()`.

### `server.config.ts`
**Cấu hình cho Elara Server (HTTP/HTTPS).**
- `ServerConfig` interface: port (default 8888 từ env), host, TLS (enable, certPath, keyPath), CORS.
- `getServerConfig()` / `updateServerConfig()` — getter/setter với mutable state.

---

## 3. CONTROLLERS (`server/src/controllers/`)

### `index.ts`
**Re-export tất cả controllers từ `chat/` và `messages/`.**

### `account.controller.ts`
**Quản lý tài khoản người dùng (CRUD + login + switch).**
- `importAccounts` (POST /v1/accounts/import): Import hàng loạt accounts, phát hiện duplicate.
- `addAccount` (POST /v1/accounts): Thêm hoặc cập nhật account. Nếu đã tồn tại (theo email+provider) thì update credential.
- `getAccounts` (GET /v1/accounts): List accounts với phân trang, filter, sort. Đánh dấu `is_active_cli` cho kiro-cli accounts.
- `deleteAccount` (DELETE /v1/accounts/:id): Xóa account và cập nhật provider count.
- `proxyIcon` (GET /v1/proxy-icon): Proxy fetch icon từ URL, cache 1 giờ.
- `login` (POST /v1/accounts/:provider/login): Login qua browser, gọi `provider.login()`.
- `switchAccount` (POST /v1/accounts/:id/switch): Chuyển đổi account active qua `provider.switchAccount()`.

### `chat.controller.ts`
**Deprecated — re-export từ `controllers/chat/index` để backward compatibility.**

### `chat/index.ts`
**Re-export các controller chat: `sendMessage`, `claudeMessagesController`, `completionController`.**

### `chat/send-message.controller.ts`
**Controller chính gửi tin nhắn chat (POST /v1/accounts/:accountId/messages).**
- Hỗ trợ stream (SSE) và non-stream mode.
- Account resolution: từ accountId param/body, providerId, hoặc modelId (auto-select).
- Hỗ trợ model `auto` — tự động chọn model theo `model_sequences`.
- Validation: conversationId bắt buộc cho multi-turn (trừ kiro-cli).
- Timeout 5 phút nếu không có response chunk đầu tiên.
- Escape HTML entities trong response content.
- Logging request/response snippets.

### `chat/claude-messages.controller.ts`
**Controller cho Anthropic-compatible API (POST /v1/chat/messages).**
- Chuyển đổi Anthropic messages format sang internal format.
- Stream mode: SSE events theo Anthropic protocol (`message_start`, `content_block_delta`, `message_delta`, `message_stop`).
- Non-stream mode: response JSON theo Anthropic format.
- Account resolution: từ model (provider/model format), hoặc auto-detect qua registry.

### `chat/completion.controller.ts`
**Controller cho OpenAI-compatible API (POST /v1/chat/completions).**
- 3 chiến lược tìm account: Bearer token, provider+email query params, hoặc auto-detect từ model.
- Stream mode: SSE events theo OpenAI format (`choices[0].delta.content`).
- Hỗ trợ `thinking`, `search`, `conversation_id`, `ref_file_ids`, `temperature`.
- Escape HTML entities.

### `claudecode.controller.ts`
**Quản lý cài đặt Claude Code CLI integration.**
- `getClaudeCodeSettings` (GET /v1/claudecode/settings): Kiểm tra Claude đã cài chưa, đọc `~/.claude/settings.json`, lấy history base URL.
- `updateClaudeCodeSettings` (POST /v1/claudecode/settings): Merge env vars vào settings file.
- `resetClaudeCodeSettings` (DELETE /v1/claudecode/settings): Xóa settings file.

### `config.controller.ts`
**Quản lý key-value config trong database.**
- `getConfigValues` (GET /v1/config/values?keys=...): Đọc nhiều config keys.
- `updateConfigValues` (PUT /v1/config/values): Upsert config keys (transaction).

### `debug.controller.ts`
**Endpoint debug.**
- `getDebugProviders` (GET /v1/debug/providers): Liệt kê providers đã load, kèm `hasHandleMessage`.

### `messages.controller.ts`
**Deprecated — re-export từ `controllers/messages/index`.**

### `messages/index.ts`
**Re-export `messagesController` và `countTokensController`.**

### `messages/messages.controller.ts`
**Controller cho Claude Code / Qwen Code CLI proxy (POST /v1/messages).**
- Session management: fingerprint dựa trên API key + nội dung message đầu tiên hoặc CLI session ID.
- Request queue: serialize concurrent requests cho cùng session fingerprint.
- Probe/warmup detection: tự động trả mock response cho các request warmup của Claude Code CLI.
- Reset command: `/reset` hoặc `!reset` để xóa session history.
- Model mapping: resolve Claude model names sang user-configured preferred models.
- Session reuse: chỉ gửi last message nếu session đã tồn tại (context compression).
- Stream: SSE events theo Anthropic protocol.

### `messages/count-tokens.controller.ts`
**Đếm token cho messages (POST /v1/messages/count_tokens).**
- Trả về `input_tokens` + buffer 100 tokens để tránh limit.

### `model.controller.ts`
**Quản lý model sequences (thứ tự ưu tiên model).**
- `getModelSequences` (GET): Lấy tất cả sequences.
- `upsertModelSequenceController` (POST): Cập nhật sequence.
- `insertModelSequenceController` (POST /insert): Chèn sequence mới và shift các sequence khác lên.
- `deleteModelSequence` (DELETE /:providerId/:modelId): Xóa sequence.

### `models.controller.ts`
**Lấy tất cả models từ enabled providers.**
- `getAllModels` (GET /v1/models/all): Gọi `getAllModelsFromEnabledProviders()`.

### `provider.controller.ts`
**API cho providers và models.**
- `getProviders` (GET /v1/providers): List providers + account counts + model stats.
- `getProviderModels` (GET /v1/providers/:providerId/models): Models của một provider.

### `stats.controller.ts`
**Thống kê sử dụng.**
- `recordMetrics` (POST /v1/chat/metrics): Ghi nhận tokens sau khi chat.
- `getStats` (GET /v1/stats): Query usage history, account stats, model stats theo period (day/week/month/year).

### `upload.controller.ts`
**Upload file lên provider.**
- `uploadFile` (POST /v1/chat/accounts/:accountId/uploads): Nhận file qua multer, gọi `provider.uploadFile()`.

---

## 4. DATABASE (`server/src/database/`)

### `index.ts`
**Re-export `initDatabase`, `getDb`, `closeDatabase`.**

### `connection.ts`
**Khởi tạo và quản lý kết nối SQLite (better-sqlite3).**
- Database path: `~/.elara/database.sqlite` (có thể custom).
- Hỗ trợ tìm native binding cho bundled app (pkg binary, npm package).
- Enable WAL mode.
- Gọi `runMigrations()` và `seedDatabase()` sau khi mở DB.

### `migrations.ts`
**Tạo và migrate tất cả các bảng database.**
- `accounts`: id, provider_id, email, credential, last_refreshed_at, usage, reset_period.
- `providers`: id, name, total_accounts.
- `commands`: id, trigger, name, description, type, action, updated_at.
- `config`: key-value store.
- `local_conversations` + `local_messages`: lưu trữ hội thoại local.
- `provider_models`: cache models từ providers.
- `provider_models_sync`: thời gian sync cuối cho dynamic providers.
- `model_sequences`: thứ tự ưu tiên model.
- `metrics`: thống kê tokens (provider, model, account, conversation, timestamp).
- `dropUnusedTables`: dọn dẹp bảng cũ không dùng.

### `seed.ts`
**Insert dữ liệu mặc định: `enable_stats_collection = true`.**

---

## 5. MIDDLEWARE (`server/src/middleware/`)

### `index.ts`
**Re-export `errorHandler`, `requestLogger`, `versionMiddleware`.**

### `error-handler.middleware.ts`
**Global error handler cho Express.**
- Nếu là `AppError`: trả về structured error với statusCode, code, stack (non-production).
- Nếu là network error (`ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`): trả 503.
- Còn lại: trả 500.

### `errorHandler.ts`
**Deprecated — re-export từ `error-handler.middleware`.**

### `logger.ts`
**Deprecated — re-export từ `request-logger.middleware`.**

### `request-logger.middleware.ts`
**Log tất cả HTTP requests (method, path, status, duration).**
- Bỏ qua path `/` và `/health`.

### `version.middleware.ts`
**Inject version info vào response.**
- Set headers: `X-Elara-Version`, `X-Elara-Update-Available`, `X-Elara-Latest-Version`.
- Monkey-patch `res.json` để inject `_elara_update` field vào JSON response nếu có update.

---

## 6. PROVIDER - DEEPSEEK (`server/src/provider/deepseek/`)

### `index.ts`
**Re-export tất cả từ deepseek module: provider, proxy handler, PoW, SSE parser, upload, types.**

### `deepseek.provider.ts`
**DeepSeek Provider implementation.**
- **Login**: Hỗ trợ basic (email/password) và Google login qua Chrome browser + MITM proxy.
- **getProfile**: Gọi `/api/v0/users/current` với Authorization header để lấy email.
- **handleMessage**: Core chat logic:
  - Tạo hoặc reuse `chat_session_id`.
  - Lấy parent_message_id từ history nếu continuing conversation.
  - Giải PoW challenge (`create_pow_challenge`) sử dụng WASM.
  - Gửi request tới `/api/v0/chat/completion`.
  - Parse SSE stream response.
  - **Auto-continue**: Nếu response INCOMPLETE (bị cắt), tự động gọi `/chat/continue` tối đa 10 lần.
  - Hỗ trợ thinking mode (deepseek-reasoner).
- **stopStream**: Gọi `/api/v0/chat/stop_generation`.
- **uploadFile**: Upload file + polling status.
- **isModelSupported**: Hỗ trợ deepseek-chat, deepseek-reasoner, deepseek-instant, deepseek-expert.
- **WASM initialization**: Tìm file `sha3_wasm_bg.7b9ca65ddd.wasm` ở nhiều possible paths.

### `deepseek.proxy-handler.ts`
**MITM proxy handler cho DeepSeek.**
- `onRequest`: Bắt Authorization header từ request tới `chat.deepseek.com`.
- `onRequestData`: Bắt email từ login request body (JSON hoặc regex).
- `onResponseBody`: Bắt token và email từ login response, Google OAuth response, và `/api/v0/users/current`.

### `deepseek.pow.ts`
**Proof-of-Work solver cho DeepSeek.**
- `DeepSeekHash` class: Load WASM module, cung cấp `calculateHash()` để giải PoW challenge.
- `solvePoW()`: Tạo PoW response từ challenge (algorithm, salt, answer, signature).
- `BASE_URL`: `https://chat.deepseek.com`.

### `deepseek.sse-parser.ts`
**Parser cho DeepSeek SSE stream.**
- `parseSSEStream()`: Parse response body, xử lý các event type:
  - `ready`: Lấy `response_message_id`.
  - `title`: Cập nhật conversation title.
  - `close`: Kết thúc stream.
  - `hint`: Server error (throw).
  - `response/status` / BATCH `quasi_status`: Phát hiện INCOMPLETE.
  - OpenAI-compat delta: `choices[0].delta.content`.
  - Fragments (initial snapshot + incremental): `THINK` và `RESPONSE` types.
- `detectPartialToolcall()`: Phát hiện tool call bị cắt giữa chừng (unclosed XML tags).
- **Deduplication**: Khi `/chat/continue` replay toàn bộ nội dung từ đầu, tự động skip phần đã emit.

### `deepseek.types.ts`
**Type definitions cho DeepSeek: `PoWChallenge`, `PoWResponse`, `ChatPayload`, `ContinuePayload`.**

### `deepseek.upload.ts`
**Upload file lên DeepSeek.**
- Giải PoW challenge cho upload.
- Tạo multipart/form-data request với boundary.
- Upload tới `/api/v0/file/upload_file`.
- Polling status file (tối đa 30 lần, mỗi lần 1 giây) đến khi `SUCCESS`, `READY`, `FAIL`, hoặc `ERROR`.
- Trả về `file_id` và `token_usage`.

---

## 7. PROVIDER - REGISTRY & CONFIG (`server/src/provider/`)

### `index.ts`
**Re-export tất cả provider instances + `providerRegistry` + `providerConfig`.**

### `provider-config.ts`
**Static config cho tất cả providers (enabled/disabled, models, capabilities).**
- Định nghĩa 21 providers: claude, deepseek, gemini, groq, huggingchat, kimi, lmArena, mistral, perplexity, qwen, stepfun, cerebras, cerebras-cloud, googlestudio, z, qwen-cli, gemini-cli, iflow-cli, codex-cli, kiro-cli.
- Mỗi provider có: `is_enabled`, `website`, `is_search`, `is_upload`, `auth_method`, `models` (optional), `is_pausable`, `connection_mode`, `concurrency_mode`.

### `registry.ts`
**Provider Registry — quản lý đăng ký và tra cứu providers.**
- `register(provider)`: Đăng ký provider (key = name.toLowerCase()), tự động tạo alias nếu name chứa dấu chấm.
- `getProvider(name)`: Tìm provider theo tên.
- `getProviderForModel(model)`: Tìm provider hỗ trợ model cụ thể (qua `isModelSupported`).
- `loadProviders()`: Dynamic import tất cả provider modules và register.
- `registerAllRoutes(router)`: Đăng ký routes cho từng provider (nếu có `registerRoutes`).

---

## 8. REPOSITORIES (`server/src/repositories/`)

### `index.ts`
**Re-export tất cả repositories.**

### `account.repository.ts`
**Data access cho bảng `accounts`.**
- `findAccountById`, `findAccountByEmailAndProvider`, `findAccountByIdOrEmailProvider`, `findFirstAccountByProvider`.
- `listAccounts`: Phân trang, filter (email LIKE, provider_id =), sort (email, order ASC/DESC).
- `insertAccount`, `insertAccountsBatch` (transaction với BEGIN IMMEDIATE/COMMIT/ROLLBACK).
- `updateAccountCredential`, `updateAccountCredentialAndRefresh`.
- `deleteAccount`.

### `provider.repository.ts`
**Data access cho bảng `providers`.**
- `findAllProviders`: Lấy tất cả providers (id, total_accounts).
- `ensureProviderExists`: INSERT OR IGNORE.
- `incrementProviderCount`, `decrementProviderCount` (không âm), `recalcProviderCount` (tính lại từ accounts).

### `provider-model.repository.ts`
**Data access cho bảng `provider_models`.**
- `findAllProviderModels`, `upsertProviderModel` (INSERT ON CONFLICT UPDATE).

### `model-sequence.repository.ts`
**Data access cho bảng `model_sequences`.**
- `findAllModelSequences`, `findFirstSequenceByProvider`, `findFirstSequenceGlobal`, `findModelSequence`.
- `upsertModelSequence`, `shiftSequencesUp` (dịch sequence >= N lên 1), `normalizeSequences` (đánh lại sequence từ 1).
- `deleteModelSequence`.

### `metrics.repository.ts`
**Data access cho bảng `metrics`.**
- `insertMetric`: Ghi metric mới.
- `queryUsageHistory`: Nhóm theo thời gian (strftime), đếm requests và sum tokens.
- `queryAccountStatsByPeriod`: Thống kê theo account (total requests, successful, tokens, max per conversation).
- `queryModelStatsByPeriod`: Thống kê theo model.

### `config.repository.ts`
**Data access cho bảng `config`.**
- `getConfigValue`, `setConfigValue` (INSERT OR REPLACE).

### `conversation.repository.ts`
**Data access cho `local_conversations`.**
- `findConversationById`, `insertConversation`, `updateConversationTitle`, `deleteConversation`.

### `message.repository.ts`
**Data access cho `local_messages`.**
- `findMessagesByConversation` (ORDER BY timestamp ASC).
- `insertMessage`, `deleteMessagesByConversation`.

### `command.repository.ts`
**Data access cho bảng `commands`.**
- `findAllCommands`, `findCommandById`, `upsertCommand`, `deleteCommand`.

---

## 9. ROUTES (`server/src/routes/`)

### `index.ts`
**Mount `/v1` routes.**

### `v1/index.ts`
**Router chính cho API v1.**
- Mount tất cả sub-routers:
  - `/chat` → `chat.routes`
  - `/accounts` → `account.routes`
  - `/providers` → `provider.routes`
  - `/messages` → `messages.routes`
  - `/debug` → `debug.routes`
  - `/config` → `config.routes`
  - `/models` → `model.routes`
  - `/model-sequences` → `model-sequences.routes`
  - `/stats` → `stats.routes`
  - `/workspaces` → `workspace.routes`
  - `/git` → `git.routes`
  - `/commands` → `command.routes`
  - `/proxy` → `proxy.routes`
  - `/claudecode` → `claudecode.routes`
- Gọi `providerRegistry.registerAllRoutes(router)` để mount provider-specific routes.

### `v1/account.routes.ts`
- `POST /import` — importAccounts
- `POST /` — addAccount
- `GET /` — getAccounts
- `DELETE /:id` — deleteAccount
- `GET /proxy-icon` — proxyIcon
- `POST /login/:provider` — login
- `POST /:id/switch` — switchAccount

### `v1/chat.routes.ts`
- `POST /accounts/messages` — sendMessage
- `POST /accounts/:accountId/messages` — sendMessage
- `POST /accounts/:accountId/uploads` — uploadFile (multer memoryStorage)
- `POST /completions` — completionController

### `v1/messages.routes.ts`
- `POST /` — messagesController (Claude Code / Qwen Code CLI)
- `POST /count_tokens` — countTokensController

### `v1/provider.routes.ts`
- `GET /` — getProviders
- `GET /:providerId/models` — getProviderModels

### `v1/model.routes.ts`
- `GET /` — getAllModels
- `GET /sequences` — getModelSequences

### `v1/model-sequences.routes.ts`
- `GET /` — getModelSequences
- `POST /` — upsertModelSequence
- `POST /insert` — insertModelSequence
- `DELETE /:providerId/:modelId` — deleteModelSequence

### `v1/config.routes.ts`
- `GET /values` — getConfigValues
- `PUT /values` — updateConfigValues

### `v1/debug.routes.ts`
- `GET /providers` — getDebugProviders

### `v1/stats.routes.ts`
- `GET /` — getStats
- `POST /metrics` — recordMetrics

### `v1/git.routes.ts`
- `POST /status` — git status
- `POST /diff-stats` — git diff numstat
- `POST /add` — git add
- `POST /commit` — git commit
- `POST /diff` — git diff (staged/unstaged)
- `POST /push` — git push

### `v1/workspace.routes.ts`
- `GET /list` — list workspaces
- `POST /link` — find or create workspace
- `DELETE /unlink/:id` — unlink workspace
- `GET /context/:id` — get context files (workspace.md + rules.md)
- `PUT /context/:id` — update context file
- `GET /summary/:workspaceId/:conversationId` — get conversation summary
- `POST /summary/:workspaceId/:conversationId` — update conversation summary
- `POST /sessions/:workspaceId/:conversationId` — create session file
- `GET /sessions/:workspaceId` — list sessions
- `POST /scan` — scan folder tree

### `v1/command.routes.ts`
- `GET /` — getAll commands
- `POST /` — add command
- `PUT /:id` — update command
- `DELETE /:id` — delete command

### `v1/claudecode.routes.ts`
- `GET /settings` — getClaudeCodeSettings
- `POST /settings` — updateClaudeCodeSettings
- `DELETE /settings` — resetClaudeCodeSettings

### `v1/proxy.routes.ts`
- `GET /config` — get proxy config
- `POST /config` — update proxy config
- `GET /server-info` — proxy server info
- `GET /certificate-info` — cert paths
- `GET /export-certificate` — export cert
- `POST /regenerate-certificates` — regenerate certs

### `v1/providers/index.ts`
- `GET /` — serve bundled provider config (static JSON).

---

## 10. SERVICES (`server/src/services/`)

### `chat.service.ts`
**Deprecated — re-export từ `services/chat/chat.service`.**

### `chat/index.ts`
**Re-export tất cả chat services.**

### `chat/chat.service.ts`
**Core chat orchestration service.**
- `sendMessage()`: Hàm chính gửi tin nhắn:
  - Kiểm tra provider enabled.
  - Lock mechanism: tránh tạo conversation trùng lặp cho cùng account (dùng `pendingConversations` Map).
  - Tạo temporary conversation ID (UUID) cho new conversations.
  - Save user message ngay lập tức qua `saveMessage()`.
  - Gọi `provider.handleMessage()` với wrapped callbacks.
  - Khi `onSessionCreated`: migrate conversation ID từ temp → real.
  - Khi `onDone`: save assistant message, record metrics, cleanup pending lock.
- Re-export `SendMessageOptions` type.

### `chat/chat-persistence.service.ts`
**Lưu trữ conversations và messages vào SQLite.**
- `saveMessage()`: INSERT OR IGNORE conversation, INSERT message, UPDATE updated_at.
- `migrateConversationId()`: Chuyển tất cả messages từ old conversation ID sang new ID (transaction).

### `chat/chat-metrics.service.ts`
**Ghi nhận metrics sau khi chat.**
- `recordChatMetrics()`: Đếm tokens (request + response), gọi `recordSuccess()`, trigger background `refreshUsage()`.

### `chat/chat-session.service.ts`
**Session management cho Claude Code / Qwen Code CLI.**
- `sessionStore`: Map fingerprint → provider session ID.
- `requestQueue`: Map fingerprint → Promise (serialize concurrent requests).
- `generateSessionFingerprint()`: Tạo fingerprint từ CLI session ID hoặc API key + first user message hash.
- `isResetCommand()`: Detect `/reset` hoặc `!reset`.
- `isProbeRequest()`: Detect warmup/probe requests từ Claude Code CLI.
- `createWarmupResponse()`: Trả mock response cho probe requests.
- `resolveClaudeModelMapping()`: Map Claude model names (opus/sonnet/haiku) sang user-configured models từ config.

### `account-refresh.service.ts`
**Tự động refresh token và usage định kỳ.**
- Chạy mỗi 1 giờ (khởi động sau 30 giây).
- Với mỗi account có refreshToken và `last_refreshed_at` > 24h: gọi `provider.refreshToken()`.
- Với mỗi account có `provider.getUsage()`: gọi `refreshUsage()` để cập nhật usage.

### `account-selector.ts`
**Logic chọn tài khoản (round-robin/priority/least-used).**
- `selectAccount()`: Chọn account theo strategy, hỗ trợ filter theo email.
- `getActiveAccounts()`: Lấy tất cả accounts (max 10000).
- `roundRobin()`: Xoay vòng đều.
- `priority()`: Luôn chọn account đầu tiên.
- `leastUsed()`: Chọn account ít request nhất.

### `command.service.ts`
**Quản lý commands (trigger → action).**
- CRUD cho bảng `commands`, type: `ai-completion` hoặc `shell`.

### `config.service.ts`
**Wrapper cho config repository với JSON serialization.**
- `get()`: Tự động parse JSON nếu có thể.
- `set()`: Tự động stringify nếu không phải string.
- `delete()`: Xóa key.

### `db.ts`
**Deprecated — re-export từ `database`.**

### `git.service.ts`
**Git operations qua `simple-git`.**
- `getStatus()`: Trả về modified, staged, untracked, conflicted, ahead/behind.
- `add()`, `commit()`, `push()`.
- `getDiffNumStat()`: Thống kê insertions/deletions per file.
- `getDiff()`: Raw diff output.

### `kiro-account.service.ts`
**Đồng bộ Kiro CLI session với local SQLite.**
- Đọc/ghi file `~/.local/share/kiro-cli/data.sqlite3`, bảng `auth_kv`, key `kirocli:social:token`.

### `login.service.ts`
**Login qua Chrome browser + MITM proxy.**
- Tìm Chrome/Chromium binary.
- Tạo temporary Chrome profile, launch với `--proxy-server` trỏ tới Elara proxy.
- Lắng nghe proxy events để capture cookies/headers/email.
- Hỗ trợ validation callback (kiểm tra token hợp lệ).
- Timeout 5 phút.
- Special handling cho Qwen: đợi real `bx-ua` và `bx-umidtoken` headers.

### `models-sync.service.ts`
**Đồng bộ models từ dynamic providers.**
- `getDynamicProvidersList()`: Providers không có models static trong config.
- `syncProviderModels()`: Gọi `provider.getModels()`, lưu vào cache.
- `scheduleNextGmtSync()`: Lên lịch sync vào GMT midnight tiếp theo.
- `getCachedModels()` / `saveCachedModels()`: Cache models trong SQLite.
- `shouldSyncProvider()`: Kiểm tra xem có cần sync không (dynamic + quá 24h).

### `provider.service.ts`
**Business logic cho providers.**
- `getAllProviders()`: Merge static config + account counts + model stats + dynamic models.
- `getProviderModels()`: Lấy models cho một provider (static → cache → dynamic fetch).
- `isProviderEnabled()`: Kiểm tra `is_enabled` trong config.
- `getAllModelsFromEnabledProviders()`: Lấy tất cả models từ enabled providers.

### `proxy-events.ts`
**EventEmitter singleton cho proxy events (login token, email, headers).**

### `proxy.service.ts`
**MITM Proxy service (dùng `http-mitm-proxy`).**
- `start()`: Khởi động proxy trên port config, với SSL interception.
- `stop()`: Đóng proxy.
- `registerHandler()`: Đăng ký handlers cho request/response interception.
- Hỗ trợ decompression (gzip, brotli, deflate) trước khi parse response body.
- `getConfig()` / `updateConfig()`: Lưu config qua `configService`.

### `scanner.service.ts`
**Quét cây thư mục dự án (tree view).**
- `generateTreeView()`: Tạo cây thư mục dạng text, filter:
  - Excluded folders: node_modules, .git, .svn, dist, build, out, coverage.
  - Excluded extensions: pdf, doc, docx, media, binary, archive.
  - Gitignore patterns.
  - Size limit (default 1MB).
  - Minified file detection (lines > 3000 chars).
  - Binary file detection (NULL byte).

### `stats.service.ts`
**Thống kê và metrics.**
- `recordRequest()`: Upsert provider_model (để tracking).
- `recordSuccess()`: Ghi nhận request thành công + insert metric.
- `recordMetric()`: Insert vào bảng metrics.
- `getUsageHistory()`: Thống kê usage theo thời gian (day: theo giờ, week: 7 ngày, month: các ngày, year: các tháng).
- `getAccountStatsByPeriod()` / `getModelStatsByPeriod()`: Thống kê theo account/model.
- Tôn trọng config `enable_stats_collection` (có thể tắt).

### `version.service.ts`
**Kiểm tra phiên bản (hiện tại disabled — luôn trả về 'dev').**

### `workspace.service.ts`
**Quản lý workspace context cho AI coding.**
- Lưu trong `~/.context_tool_data/`.
- `listWorkspaces()`, `findOrCreateWorkspace()`: Quản lý workspaces (root.json).
- `getContextFiles()`, `updateContextFile()`: workspace.md + workspace_rules.md.
- `getConversationSummary()`, `updateConversationSummary()`: Summary markdown files.
- `createSessionFile()`, `getSessions()`: Session JSON files (task progress, messages, tokens).
- Tự động tạo template `workspace.md` khi tạo workspace mới.

---

## 11. TYPES (`server/src/types/`)

### `index.ts`
**Re-export tất cả type modules.**

### `account.types.ts`
**Zod schema + type cho Account, ImportAccountResult.**

### `api.types.ts`
**ApiResponse, ApiErrorBody, ApiMeta, Pagination, ApiError interfaces.**

### `chat.types.ts`
**Zod schema cho ChatRequest, StreamResponse.**

### `command.types.ts`
**Command interface.**

### `git.types.ts`
**GitStatusSummary, FileDiffStats interfaces.**

### `message.types.ts`
**Zod schema cho Message (role: user/assistant/system, content: string).**

### `model.types.ts`
**Model, ModelSequence, CachedModel interfaces.**

### `provider.types.ts`
**Core types:**
- `SendMessageOptions`: Tất cả options khi gửi message (credential, model, messages, callbacks).
- `Provider`: Interface mà mọi provider phải implement (handleMessage, login, getProfile, refreshToken, getUsage, uploadFile, getModels, switchAccount, proxyHandler...).
- `ProxyHandler`: Interface cho MITM proxy interception.

### `stats.types.ts`
**StatsPeriod, UsageHistoryEntry, AccountStats, ModelStats, PeriodStats.**

### `workspace.types.ts`
**WorkskspaceInfo, RootConfig.**

---

## 12. UTILS (`server/src/utils/`)

### `api-error.ts`
**AppError class (extends Error, implements ApiError).**
- Có `statusCode`, `code`.
- `createError()` factory function.

### `apiError.ts`
**Deprecated — re-export từ `api-error`.**

### `api-response.ts`
**ApiResponseBuilder class với static methods:**
- `success()`, `error()`, `notFound()`, `badRequest()`, `methodNotAllowed()`, `unauthorized()`, `forbidden()`, `conflict()`, `internalError()`.
- Tất cả đều bao gồm `meta.timestamp`.

### `apiResponse.ts`
**Deprecated — re-export từ `api-response`.**

### `cert-manager.ts`
**Quản lý chứng chỉ SSL cho MITM proxy.**
- `CertificateManager` class:
  - `ensureCertificates()`: Kiểm tra hoặc tạo certs.
  - `generateCertificates()`: Dùng OpenSSL CLI.
  - `generateCertificatesWithNodeForge()`: Fallback dùng `node-forge` nếu OpenSSL không có.
  - `exportCertificate()`: Đọc cert file.
  - `deleteCertificates()`: Xóa certs.
- Cert lưu trong `~/.elara/certs/` (hoặc electron `userData`).

### `chat-validator.ts`
**Validation helper cho chat requests.**
- `validateChatRequest()`: Middleware placeholder.
- `validateProviderCapabilities()`: Kiểm tra provider có hỗ trợ search không.

### `cookie-jar.ts`
**Cookie jar wrapper quanh `tough-cookie`.**
- `setCookie()`, `getCookieString()`, `getCookies()`, `clear()`, `toJSON()`, `fromJSON()`.

### `env-info.ts`
**Detect runtime environment.**
- Phát hiện: `isBinary` (pkg), `isDev` (.ts file), `isNpmPackage` (trong node_modules).
- Cung cấp `baseDir` cho việc resolve paths.

### `http-client.ts`
**HTTP client wrapper quanh `node-fetch`.**
- Hỗ trợ: baseURL, default headers, cookie jar.
- Methods: `get()`, `post()`, `request()`.
- `streamSSE()`: Async generator để parse SSE stream.

### `logger.ts`
**Logger với màu sắc ANSI.**
- `createLogger(context)`: Tạo logger instance với context name.
- Levels: INFO, ERROR, WARN, DEBUG.
- Format: `[LEVEL] [file:line] message metadata`.
- Tự động detect caller file từ stack trace.

### `port.ts`
**Kill process đang chiếm port.**
- `killPort(port)`: Dùng `lsof -t -i:PORT` để tìm PID, rồi `SIGKILL`.

### `tokenizer.ts`
**Đếm token sử dụng `js-tiktoken` (cl100k_base encoding).**
- `countTokens(text)`: Đếm token trong string.
- `countMessagesTokens(messages)`: Đếm tổng token trong mảng messages (+ 4 overhead mỗi message).
- Fallback: `Math.ceil(text.length / 4)` nếu tiktoken lỗi.

---

## Tổng quan luồng xử lý chính

1. **Khởi động**: `index.ts` → `env.ts` → `initDatabase()` → `startServer()` → `createApp()` → load providers → start HTTP/HTTPS.
2. **Chat request**: Controller (`send-message.controller.ts` hoặc `completion.controller.ts` hoặc `claude-messages.controller.ts` hoặc `messages.controller.ts`) → resolve account → `chat.service.ts` (`sendMessage`) → `provider.handleMessage()` → SSE stream về client.
3. **Login**: `account.controller.ts` (`login`) → `provider.login()` → `login.service.ts` → Chrome browser + MITM proxy → capture token → validate → return.
4. **Thống kê**: Sau mỗi response, `chat-metrics.service.ts` gọi `recordSuccess()` → `stats.service.ts` → insert metric.
5. **Background tasks**: `account-refresh.service.ts` định kỳ refresh token + usage. `models-sync.service.ts` định kỳ sync models từ dynamic providers.