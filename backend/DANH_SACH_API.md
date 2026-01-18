# Danh sách API của CLIProxyAPI

Dưới đây là danh sách toàn bộ các API endpoint được tìm thấy trong source code của dự án `temp/CLIProxyAPI`.

## 1. API Chính (Main Server)

Các API này phục vụ cho các chức năng cơ bản và kiểm tra trạng thái.

- `GET /` - Thông tin cơ bản về server.
- `GET /management.html` - Giao diện quản lý (Control Panel).
- `GET /keep-alive` - Endpoint giữ kết nối (nếu được bật).
- `OPTIONS *` - Xử lý CORS cho tất cả các request.

## 2. API Chat & Models (V1 Standard)

Các API này tương thích với chuẩn OpenAI và Anthropic.

- **Models:**
    - `GET /v1/models` - Lấy danh sách models (hỗ trợ cả format OpenAI và Claude tùy theo User-Agent).
- **Chat & Completions:**
    - `POST /v1/chat/completions` - Chat completion (chuẩn OpenAI).
    - `POST /v1/completions` - Text completion (chuẩn OpenAI).
    - `POST /v1/responses` - Endpoint xử lý responses (OpenAI).
- **Anthropic / Claude:**
    - `POST /v1/messages` - Gửi tin nhắn (chuẩn Anthropic).
    - `POST /v1/messages/count_tokens` - Đếm token (chuẩn Anthropic).

## 3. API Gemini (V1 Beta)

Các API tương thích với Google Gemini.

- `GET /v1beta/models` - Lấy danh sách models Gemini.
- `POST /v1beta/models/*action` - Thực hiện hành động với model (chat, generate content...).
- `GET /v1beta/models/*action` - Lấy thông tin model cụ thể.

## 4. API Nội bộ & Callbacks

- `POST /v1internal:method` - API nội bộ cho CLI handler.
- **Callback OAuth:**
    - `GET /anthropic/callback`
    - `GET /codex/callback`
    - `GET /google/callback`
    - `GET /iflow/callback`
    - `GET /antigravity/callback`

## 5. API Quản lý (Management API)

Prefix: `/v0/management`

- **Cấu hình & Phiên bản:**
    - `GET /config` - Xem cấu hình hiện tại.
    - `GET /config.yaml` - Xem cấu hình dạng YAML.
    - `PUT /config.yaml` - Cập nhật cấu hình YAML.
    - `GET /latest-version` - Kiểm tra phiên bản mới nhất.
- **Debug & Logs:**
    - `GET /debug` - Lấy trạng thái debug.
    - `PUT/PATCH /debug` - Bật/tắt debug.
    - `GET/PUT/PATCH /logging-to-file` - Cấu hình ghi log ra file.
    - `GET/PUT/PATCH /logs-max-total-size-mb` - Cấu hình dung lượng log tối đa.
    - `GET /logs` - Xem logs.
    - `DELETE /logs` - Xóa logs.
    - `GET /request-error-logs` - Danh sách log lỗi.
    - `GET /request-error-logs/:name` - Tải log lỗi.
    - `GET /request-log` - Cấu hình request logging.
    - `GET /request-log-by-id/:id` - Xem chi tiết request log.
- **Thống kê & Usage:**
    - `GET /usage` - Xem thống kê sử dụng.
    - `GET /usage/export` - Xuất thống kê.
    - `POST /usage/import` - Nhập thống kê.
    - `GET/PUT/PATCH /usage-statistics-enabled` - Bật/tắt thống kê.
- **Auth & Keys:**
    - `GET/PUT/PATCH/DELETE /api-keys` - Quản lý API keys chung.
    - `GET/PUT/PATCH/DELETE /gemini-api-key` - Quản lý Gemini key.
    - `GET/PUT/PATCH/DELETE /claude-api-key` - Quản lý Claude key.
    - `GET/PUT/PATCH/DELETE /codex-api-key` - Quản lý Codex key.
    - `GET/PUT/PATCH/DELETE /vertex-api-key` - Quản lý Vertex AI key.
    - `GET /anthropic-auth-url`, `/codex-auth-url`, ... - Lấy URL xác thực OAuth.
    - `POST /oauth-callback` - Xử lý callback OAuth thủ công.
    - `GET /auth-files` - Danh sách file auth.
- **AMP Code & Proxy:**
    - `GET/PUT/PATCH /request-retry` - Cấu hình retry.
    - `GET/PUT/PATCH/DELETE /proxy-url` - Cấu hình Proxy URL.
    - `POST /api-call` - Thực hiện API call test.
    - `GET/PUT/PATCH/DELETE /ampcode/upstream-url` - URL upstream của AMP.
    - `GET/PUT/PATCH/DELETE /ampcode/model-mappings` - Map tên model.

*(Lưu ý: Còn nhiều endpoint quản lý khác chi tiết trong code nhưng trên đây là các nhóm chính)*

## 6. AMP Module API

Các API được cung cấp bởi module AMP (Agent Protocol).

- **Proxy Routes (chuyển tiếp tới upstream):**
    - `ANY /api/internal/*path`
    - `ANY /api/user/*path`
    - `ANY /api/auth/*path`
    - `ANY /api/meta/*path`
    - `ANY /api/threads/*path`
- **Provider Aliases (Giả lập đa provider):**
    - Định dạng: `/api/provider/:provider/...`
    - Ví dụ: `/api/provider/openai/v1/chat/completions`
    - Hỗ trợ các provider: `anthropic`, `google`, `openai`, v.v.
    - Gồm đầy đủ các endpoint models, chat completions, messages tương ứng với từng provider.
- **Root Proxies:**
    - `GET /threads/*path`, `/docs/*path`, `/settings/*path`
    - `GET /threads.rss`, `/news.rss`
    - `ANY /auth/*path`

---
*Tài liệu được tạo tự động dựa trên phân tích source code.*
