# Hướng Dẫn: Sử Dụng ClaudeCode CLI với ChatGPT API qua Proxy

## Tổng Quan

Tutorial này hướng dẫn cách cấu hình **ClaudeCode CLI** để sử dụng **ChatGPT** thông qua **CLIProxyAPI/Elara proxy server**.

### Tại sao cần Proxy?

ClaudeCode CLI mặc định chỉ connect tới Claude API. Nhưng với proxy:

- ✅ Dùng ChatGPT subscription cho ClaudeCode
- ✅ Load balance qua nhiều ChatGPT accounts
- ✅ Không cần Claude API key
- ✅ Dùng được tất cả models: GPT-4, GPT-4 Turbo, DeepSeek...

---

## Bước 1: Chuẩn Bị

### 1.1. Cài Đặt Tools

**ClaudeCode CLI:**

```bash
npm install -g @anthropics/claude-cli
# hoặc
brew install claude-cli
```

**CLIProxyAPI (hoặc Elara):**

```bash
# Option 1: CLIProxyAPI
git clone https://github.com/router-for-me/CLIProxyAPI.git
cd CLIProxyAPI
go run cmd/server/main.go

# Option 2: Elara (nếu đang dùng)
cd Elara
npm run dev
```

### 1.2. Kiểm Tra Server Đang Chạy

```bash
curl http://localhost:8317/
```

**Response mong đợi:**

```json
{
  "message": "CLI Proxy API Server",
  "endpoints": ["POST /v1/chat/completions", "POST /v1/completions", "GET /v1/models"]
}
```

---

## Bước 2: Thêm ChatGPT Account vào Proxy

### 2.1. OAuth Login (Recommended)

**Cách 1: Qua Management UI**

1. Mở browser: `http://localhost:8317/management.html`
2. Click vào tab **"Accounts"**
3. Click **"Add Account"** → **"OpenAI Codex"**
4. Click **"Start OAuth Login"**
5. Browser sẽ mở trang login OpenAI
6. Login với ChatGPT account của bạn
7. Approve permissions
8. Redirect về proxy → Account saved!

**Cách 2: Qua API**

```bash
# Lấy auth URL
curl http://localhost:8317/v0/management/codex-auth-url

# Response:
{
  "auth_url": "https://auth.openai.com/authorize?...",
  "state": "abc123"
}

# Mở browser với auth_url, login, approve
# OpenAI redirect về: http://localhost:8317/codex/callback?code=xxx&state=abc123
# Server tự động lưu account
```

**Cách 3: Manual với API Key (cho API accounts)**

```bash
curl -X PUT http://localhost:8317/v0/management/codex-api-key \
  -H "Content-Type: application/json" \
  -d '{
    "api-key": "sk-proj-...",
    "prefix": "chatgpt-main"
  }'
```

### 2.2. Verify Account Đã Thêm

```bash
curl http://localhost:8317/v0/management/auth-files
```

**Response:**

```json
{
  "files": [
    {
      "name": "codex-myaccount.json",
      "provider": "codex",
      "created": "2024-01-14T10:00:00Z"
    }
  ]
}
```

---

## Bước 3: Cấu Hình Proxy Settings

### 3.1. Add API Key cho Authentication

**Edit config file:** `~/.cli-proxy-api/config.yaml` (hoặc `config.yaml` trong project)

```yaml
# Server settings
host: '127.0.0.1'
port: 8317

# API keys để authenticate requests
api-keys:
  - 'your-secure-api-key-here' # ClaudeCode sẽ dùng key này

# Routing strategy
routing:
  strategy: 'round-robin' # Load balance qua accounts

# Enable debug (optional)
debug: true
```

**Save và restart server:**

```bash
# Stop server (Ctrl+C)
# Start lại
go run cmd/server/main.go
# hoặc với Elara
npm run dev
```

### 3.2. Verify Configuration

```bash
curl http://localhost:8317/v0/management/config
```

**Response:**

```json
{
  "host": "127.0.0.1",
  "port": 8317,
  "api-keys": ["your-secure-api-key-here"],
  "routing": { "strategy": "round-robin" }
}
```

---

## Bước 4: Cấu Hình ClaudeCode CLI

### 4.1. Set Base URL

ClaudeCode CLI sử dụng env variables để override API endpoint:

```bash
export ANTHROPIC_BASE_URL="http://localhost:8317"
export ANTHROPIC_API_KEY="your-secure-api-key-here"
```

**Hoặc tạo file `.env` trong project:**

```bash
ANTHROPIC_BASE_URL=http://localhost:8317
ANTHROPIC_API_KEY=your-secure-api-key-here
```

### 4.2. Test Connection

```bash
claude --version
claude config
```

### 4.3. Cấu Hình Permanent (Optional)

**Thêm vào `~/.bashrc` hoặc `~/.zshrc`:**

```bash
# ClaudeCode CLI via Proxy
export ANTHROPIC_BASE_URL="http://localhost:8317"
export ANTHROPIC_API_KEY="your-secure-api-key-here"
```

**Apply:**

```bash
source ~/.bashrc
# hoặc
source ~/.zshrc
```

---

## Bước 5: Test với ClaudeCode CLI

### 5.1. List Available Models

```bash
claude models list
```

**Kết quả mong đợi:**

```
Available models:
- gpt-4-turbo
- gpt-4
- gpt-3.5-turbo
- deepseek-chat
- deepseek-reasoner
```

**Lưu ý:** Nếu thấy models từ ChatGPT → proxy hoạt động! ✅

### 5.2. Gửi Chat Message

```bash
claude chat --model gpt-4 "Hello, are you ChatGPT?"
```

**Kết quả mong đợi:**

```
Yes, I'm ChatGPT, an AI assistant created by OpenAI. How can I help you today?
```

### 5.3. Interactive Chat Session

```bash
claude chat --model gpt-4-turbo
```

**Màn hình xuất hiện:**

```
Claude CLI v1.0.0
Connected to: http://localhost:8317/v1/messages
Model: gpt-4-turbo

You: Hello!
Assistant: Hi! I'm ChatGPT. How can I assist you today?

You: What's your name?
Assistant: I'm ChatGPT, built by OpenAI.

You: /exit
```

---

## Bước 6: Các Use Cases Nâng Cao

### 6.1. Chỉ Định Model Cụ Thể

```bash
# Dùng GPT-4 Turbo
claude chat --model gpt-4-turbo "Write a poem"

# Dùng DeepSeek Reasoner
claude chat --model deepseek-reasoner "Solve: 2+2"

# Dùng GPT-3.5 (faster, cheaper)
claude chat --model gpt-3.5-turbo "Quick question"
```

### 6.2. Code Generation

```bash
claude code --model gpt-4-turbo \
  --prompt "Create a REST API in Node.js with Express" \
  --output ./api-server.js
```

### 6.3. File Context

```bash
claude chat --model gpt-4 \
  --file ./README.md \
  --prompt "Summarize this README"
```

### 6.4. System Prompt

```bash
claude chat --model gpt-4 \
  --system "You are a Python expert" \
  --prompt "Explain decorators"
```

---

## Bước 7: Load Balancing với Nhiều Accounts

### 7.1. Thêm Account Thứ 2

**Repeat Bước 2** để thêm thêm ChatGPT account:

```bash
# OAuth login cho account thứ 2
curl http://localhost:8317/v0/management/codex-auth-url
# Login với account GPT khác
```

### 7.2. Verify Multi-Accounts

```bash
curl http://localhost:8317/v0/management/auth-files
```

**Response:**

```json
{
  "files": [
    { "name": "codex-account1.json", "provider": "codex" },
    { "name": "codex-account2.json", "provider": "codex" }
  ]
}
```

### 7.3. Test Load Balancing

```bash
# Request 1 → Account 1
claude chat --model gpt-4 "Request 1"

# Request 2 → Account 2 (round-robin)
claude chat --model gpt-4 "Request 2"

# Request 3 → Account 1 again
claude chat --model gpt-4 "Request 3"
```

**Check logs ở proxy server để verify routing!**

---

## Bước 8: Monitoring & Debugging

### 8.1. View Usage Statistics

```bash
curl http://localhost:8317/v0/management/usage
```

**Response:**

```json
{
  "total_requests": 150,
  "total_tokens": 45000,
  "by_provider": {
    "codex": {
      "requests": 150,
      "tokens": 45000
    }
  }
}
```

### 8.2. View Request Logs

```bash
curl http://localhost:8317/v0/management/logs
```

### 8.3. Enable Debug Mode

**Edit config:**

```yaml
debug: true
```

**Restart server → xem detailed logs!**

### 8.4. Test API Directly

```bash
curl -X POST http://localhost:8317/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secure-api-key-here" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

---

## Troubleshooting

### Lỗi: "Connection refused"

**Nguyên nhân:** Proxy server không chạy

**Fix:**

```bash
# Check server status
curl http://localhost:8317/

# Restart server
cd CLIProxyAPI
go run cmd/server/main.go
```

---

### Lỗi: "Unauthorized" hoặc "Invalid API key"

**Nguyên nhân:** API key không đúng

**Fix:**

```bash
# Verify API key trong config
curl http://localhost:8317/v0/management/config

# Update env variable
export ANTHROPIC_API_KEY="correct-api-key-here"
```

---

### Lỗi: "No active accounts"

**Nguyên nhân:** Chưa add ChatGPT account

**Fix:**

```bash
# Verify accounts
curl http://localhost:8317/v0/management/auth-files

# Nếu empty → repeat Bước 2
```

---

### Lỗi: "Model not found"

**Nguyên nhân:** Model name sai hoặc account không có access

**Fix:**

```bash
# List available models
curl http://localhost:8317/v1/models

# Dùng model có trong list
claude chat --model gpt-4-turbo "test"
```

---

### ClaudeCode vẫn connect tới Claude API

**Nguyên nhân:** Env variable không được set

**Fix:**

```bash
# Verify env
echo $ANTHROPIC_BASE_URL
# Should output: http://localhost:8317

# Set lại
export ANTHROPIC_BASE_URL="http://localhost:8317"
export ANTHROPIC_API_KEY="your-api-key"

# Test
claude chat --model gpt-4 "test"
```

---

## Advanced: HTTPS với Self-Signed Certificate

Nếu muốn dùng HTTPS (recommended cho production):

### 1. Enable TLS trong config:

```yaml
tls:
  enable: true
  cert: '/path/to/cert.pem'
  key: '/path/to/key.pem'
```

### 2. Generate self-signed cert:

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

### 3. Update ClaudeCode config:

```bash
export ANTHROPIC_BASE_URL="https://localhost:8317"
export NODE_TLS_REJECT_UNAUTHORIZED=0  # Accept self-signed
```

---

## Best Practices

### 1. Security

- ✅ Dùng strong API keys
- ✅ Localhost only (`host: "127.0.0.1"`)
- ✅ Enable TLS cho production
- ❌ Không expose port 8317 ra internet

### 2. Performance

- ✅ Dùng round-robin strategy
- ✅ Add nhiều accounts để tránh rate limits
- ✅ Monitor usage statistics
- ✅ Enable caching (nếu proxy support)

### 3. Monitoring

- ✅ Check logs thường xuyên
- ✅ Set up alerts cho errors
- ✅ Track token usage
- ✅ Monitor response times

---

## Tổng Kết

### Bạn đã học:

✅ Cài đặt và config CLIProxyAPI/Elara  
✅ OAuth login để thêm ChatGPT accounts  
✅ Config ClaudeCode CLI sử dụng proxy  
✅ Gửi/nhận messages qua proxy  
✅ Load balancing với nhiều accounts  
✅ Monitoring và debugging  
✅ Troubleshooting common issues

### Next Steps:

1. **Add more providers:** Thêm Gemini, DeepSeek, Claude...
2. **Model aliasing:** Rename models cho dễ nhớ
3. **Auto-failover:** Config quota switching
4. **Web UI:** Dùng management panel để manage

### Workflow Hoàn Chỉnh:

```
┌─────────────────┐
│  ClaudeCode CLI │
│  (User Input)   │
└────────┬────────┘
         │ POST /v1/messages
         │ Model: gpt-4
         ▼
┌─────────────────────┐
│   Proxy Server      │
│   (Port 8317)       │
│                     │
│ 1. Authenticate     │
│ 2. Route to GPT     │
│ 3. Load Balance     │
└────────┬────────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼──┐   ┌──▼───┐
│GPT-1 │   │GPT-2 │
│Acc   │   │Acc   │
└───┬──┘   └──┬───┘
    │         │
    └────┬────┘
         ▼
    ┌─────────┐
    │Response │
    │"Hello!" │
    └─────────┘
```

**Happy coding!** 🚀
