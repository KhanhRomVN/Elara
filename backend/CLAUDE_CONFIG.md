# Hướng dẫn Cấu hình Claude với Elara Backend

Để sử dụng Claude (CLI hoặc VSCode extensions như Claude Dev/Roo Code) với backend Elara (đã được cấu hình để route qua DeepSeek), bạn cần thực hiện các bước sau:

## 1. Yêu cầu Tiên quyết

*   **Elara Backend** đang chạy (thường là `http://localhost:3000`).
*   Trong Elara, bạn phải có **ít nhất một tài khoản DeepSeek** đang ở trạng thái `Active`.

## 2. Cấu hình Claude Code (CLI)

Nếu bạn sử dụng công cụ dòng lệnh `claude` (Claude Code):

Tại terminal, bạn có thể thiết lập biến môi trường `CLAUDE_BASE_URL` trỏ về backend của Elara.

```bash
# Thiết lập Base URL (Lưu ý: không có /v1 ở cuối vì CLI thường tự thêm hoặc dùng structure khác, 
# nhưng với Elara ta mount tại /v1. Nếu CLI không hoạt động, hãy thử thêm /v1)
export CLAUDE_BASE_URL="http://localhost:3000/v1"

# Thiết lập API Key (Giá trị bất kỳ, nhưng cần có để bypass validate của client)
export ANTHROPIC_API_KEY="sk-elara-proxy-dummy-key"

# Chạy Claude
claude
```

Nếu cách trên không hoạt động do `claude` CLI check certificate hoặc strict url, bạn có thể cần dùng cấu hình qua file config (nếu CLI hỗ trợ) hoặc dùng proxy trung gian khác.

Tuy nhiên, endpoint `/v1/messages` của Elara đã được thiết kế để tương thích chuẩn Anthropic.

## 3. Cấu hình các Extension (VSCode)

Ví dụ với **Roo Code** (trước đây là Roo Cline) hoặc các extension hỗ trợ OpenAI/Anthropic Compatible:

1.  Mở cài đặt Extension.
2.  Chọn **API Provider**: `OpenAI Compatible` hoặc `Anthropic` (nếu cho phép đổi Base URL).
3.  **Base URL**: `http://localhost:3000/v1`
4.  **API Key**: `any-key-is-ok`
5.  **Model**: Chọn `gpt-4` hoặc `claude-3-5-sonnet...` (Elara sẽ tự động nhận diện và chuyển hướng về DeepSeek).

## 4. Kiểm tra hoạt động

Bạn có thể test nhanh bằng `curl`:

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: dummy" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "messages": [
        {"role": "user", "content": "Hello, are you using DeepSeek?"}
    ],
    "stream": true
  }'
```

Nếu thấy kết quả trả về dạng stream (`event: message_start`, `event: content_block_delta`...), nghĩa là backend đã hoạt động chính xác.
