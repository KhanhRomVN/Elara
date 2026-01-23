# Claude Code Sync Logic Documentation

Tài liệu này giải thích luồng hoạt động khi nhấn button **"Create & Apply to System"** (hoặc **"Save & Apply to System"**) trong ứng dụng Elara.

## 1. Flow Tổng Quan

Khi button được nhấn, ứng dụng thực hiện 2 hành động liên tiếp qua Electron IPC:

1. `handleSave()`: Lưu cấu hình vào cơ sở dữ liệu SQLite của ứng dụng.
2. `handleSaveToSystem()`: Ghi các biến môi trường vào file shell profile của hệ điều hành.

---

## 2. Chi Tiết Các Cuộc Gọi IPC

### A. IPC: `extended-tools:upsert`

Được gọi bởi hàm `handleSave()`.

- **Mục đích**: Lưu trữ trạng thái cấu hình của Elara (bao gồm cả các tùy chọn UI).
- **Request Body (`tool`)**:

```json
{
  "tool_id": "claude_code",
  "tool_name": "Claude Code",
  "website": "https://claude.ai/",
  "url": "http://localhost:3030/chat/messages", // Hoặc URL tùy chỉnh
  "provider_id": "auto", // ID của provider trong Elara mode
  "model_id": "auto",
  "config": {
    "mode": "elara", // "elara" hoặc "normal"
    "authToken": "sk-ant-...",
    "normalModel": "claude-3-5-sonnet-20241022",
    "normalOpus": "...",
    "normalSonnet": "...",
    "normalHaiku": "...",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "elara://provider/model", // Nếu ở elara mode
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "...",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "..."
  }
}
```

### B. IPC: `server:save-env-to-system`

Được gọi bởi hàm `handleSaveToSystem()`.

- **Mục đích**: Áp dụng các biến môi trường để lệnh `claude` trong terminal có thể nhận diện được cấu hình của Elara.
- **Request Body (`envVars`)**:

```json
{
  "ANTHROPIC_BASE_URL": "http://localhost:3030/chat/messages",
  "ANTHROPIC_AUTH_TOKEN": "...",
  "ANTHROPIC_MODEL": "elara://...", // Hoặc tên model trực tiếp
  "ANTHROPIC_DEFAULT_OPUS_MODEL": "...",
  "ANTHROPIC_DEFAULT_SONNET_MODEL": "...",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL": "..."
}
```

---

## 3. Cách Backend Lưu Trữ

### A. Trong Database SQLite

- **Path**: `backend/database.sqlite`
- **Table**: `extended_tools`
- **Logic**:
  - Backend sử dụng `extended-tool.service.ts`.
  - Nếu `tool_id` chưa tồn tại trong bảng, nó sẽ sinh một `UUID` mới và thực hiện lệnh `INSERT`.
  - Nếu đã tồn tại, nó thực hiện `UPDATE` dựa trên `tool_id`.
  - Trường `config` được lưu dưới dạng chuỗi JSON (`JSON.stringify`).

### B. Trong Hệ Thống (System Shell)

- **Cơ chế**: Backend tự động phát hiện shell đang sử dụng (bash, zsh, fish, powershell...).
- **File Profile**:
  - Linux/macOS: `.bashrc`, `.zshrc`, hoặc `.config/fish/config.fish`.
  - Windows: `Microsoft.PowerShell_profile.ps1` hoặc `elara_env.cmd`.
- **Nội dung lưu**: Backend sẽ chèn/cập nhật một khối mã được đánh dấu bằng comment để không làm hỏng file profile của người dùng:

```bash
# === ELARA CLAUDE CODE ENV START ===
export ANTHROPIC_BASE_URL="http://localhost:3030/chat/messages"
export ANTHROPIC_AUTH_TOKEN="..."
export ANTHROPIC_MODEL="elara://..."
...
# === ELARA CLAUDE CODE ENV END ===
```

- Sau khi ghi file, người dùng cần chạy lệnh `source ~/.bashrc` (hoặc tương đương) hoặc khởi động lại terminal để các thay đổi có hiệu lực.
