# Backend Database Schema

Tài liệu này liệt kê toàn bộ các bảng đang có trong database SQLite của backend Elara.

---

## Danh sách các bảng

### 1. `accounts`

Lưu trữ thông tin tài khoản của các provider.

- `id`: (TEXT, PK) ID duy nhất của tài khoản.
- `provider_id`: (TEXT) ID của provider (gemini, claude, deepseek...).
- `email`: (TEXT) Email đăng ký tài khoản.
- `credential`: (TEXT) Thông tin xác thực (Cookie, API Key...).

### 2. `providers`

Lưu trữ danh sách các provider được hỗ trợ.

- `id`: (TEXT, PK) ID của provider.
- `name`: (TEXT) Tên hiển thị.
- `is_enabled`: (INTEGER) Trạng thái kích hoạt.
- `total_accounts`: (INTEGER) Tổng số tài khoản đang có.

### 3. `provider_models`

Lưu trữ danh sách model của từng provider.

- `id`: (INTEGER, PK, AI) ID tự tăng.
- `provider_id`: (TEXT) ID của provider.
- `model_id`: (TEXT) ID của model.
- `model_name`: (TEXT) Tên model.
- `is_thinking`: (INTEGER) Có hỗ trợ chế độ suy nghĩ (Thinking) hay không.
- `context_length`: (INTEGER) Độ dài ngữ cảnh.
- `updated_at`: (INTEGER) Thời gian cập nhật cuối.
- _Unique_: `(provider_id, model_id)`

### 4. `metrics`

Lưu trữ lịch sử sử dụng token và request.

- `id`: (INTEGER, PK, AI) ID tự tăng.
- `provider_id`: (TEXT) ID của provider.
- `model_id`: (TEXT) ID của model.
- `account_id`: (TEXT) ID của tài khoản thực hiện request.
- `conversation_id`: (TEXT) ID hội thoại (nếu có).
- `total_tokens`: (INTEGER) Tổng số token sử dụng.
- `timestamp`: (INTEGER) Thời gian thực hiện request.
- **Chỉ mục (Indexes)**:
  - `idx_metrics_timestamp`: Trên `timestamp`.
  - `idx_metrics_conversation_id`: Trên `conversation_id`.
  - `idx_metrics_account_time`: Tổ hợp trên `(account_id, timestamp)`.
  - `idx_metrics_provider_model_time`: Tổ hợp trên `(provider_id, model_id, timestamp)`.

### 5. `config`

Lưu trữ các cấu hình hệ thống dưới dạng key-value.

- `key`: (TEXT, PK) Tên cấu hình.
- `value`: (TEXT) Giá trị cấu hình.

### 6. `codebase_index`

Quản lý index của các codebase (RAG).

- `id`: (INTEGER, PK, AI)
- `project_path`: (TEXT) Đường dẫn project.
- `target_path`: (TEXT) Đường dẫn file/folder được đánh index.
- `target_type`: (TEXT) Loại (`file` hoặc `folder`).
- `content`: (TEXT) Nội dung hoặc metadata.
- `indexed_at`: (INTEGER) Thời gian đánh index.

### 7. `provider_models_sync`

Theo dõi trạng thái đồng bộ model của các dynamic provider.

- `provider_id`: (TEXT, PK)
- `last_sync_at`: (INTEGER)
- `is_dynamic`: (INTEGER)

### 8. `model_sequences`

Thứ tự ưu tiên/hiển thị của các model.

- `provider_id`: (TEXT)
- `model_id`: (TEXT)
- `sequence`: (INTEGER) Thứ tự.
- `updated_at`: (INTEGER)
- _PK_: `(provider_id, model_id)`
