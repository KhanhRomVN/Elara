# Tóm tắt Kiến trúc & Thuật toán Nhà cung cấp

Tài liệu này phác thảo các chiến lược dịch ngược (reverse-engineering) và tích hợp được sử dụng cho Claude, DeepSeek, và ChatGPT trong ứng dụng Elara.

## 1. Claude (Anthropic)

**Loại xác thực:** Cookie (`sessionKey`)

### Thuật toán Đăng nhập

1.  **Khởi tạo Webview:** Mở một `BrowserWindow` đến `https://claude.ai/login`.
2.  **Thăm dò Cookie:** Liên tục kiểm tra cookie phiên để tìm `sessionKey`.
3.  **Lấy thông tin Hồ sơ:** Khi tìm thấy key:
    - Gửi yêu cầu `GET https://claude.ai/api/organizations`.
    - Trích xuất email tài khoản từ tên tổ chức.
4.  **Hoàn tất:** Lưu `sessionKey` vào `accounts.json`.

### Thuật toán Tin nhắn

- **API:** `https://claude.ai/api`
- **Phương thức:** HTTP Request thuần (`net.request`).
- **Luồng:** Lấy `Organization UUID` -> Tạo `Conversation UUID` -> Gửi `POST Completion` kèm Cookie.

---

## 2. DeepSeek (DeepSeek Chat)

**Loại xác thực:** JWT/Bearer Token (`userToken` trong LocalStorage)

### Thuật toán Đăng nhập

1.  **Khởi tạo Webview:** Mở `BrowserWindow` đến `https://chat.deepseek.com/login`.
2.  **Chặn Traffic:** Bắt email từ request `POST /api/v0/users/login`.
3.  **Lấy Token:** Trích xuất `userToken` từ `localStorage`.

### Thuật toán Tin nhắn

- **API:** `https://chat.deepseek.com/api/v0`
- **Bảo mật (PoW):** Requires **Proof-of-Work**.
- **Cơ chế:**
  1.  Gọi `POST /chat/create_pow_challenge` lấy `difficulty`, `salt`.
  2.  Dùng **WASM Module** (`sha3_wasm_bg.wasm`) để tính toán hash thỏa mãn độ khó.
  3.  Gửi `POST /chat/completion` kèm header `X-Ds-Pow-Response`.

---

## 3. ChatGPT (OpenAI)

**Loại xác thực:** Hybrid (Cookie `__Secure-next-auth.session-token` đổi lấy **Bearer JWT**)

### Phân tích Kiến trúc (Lý thuyết)

Nếu gọi qua HTTPS thuần, ChatGPT hoạt động như sau:

1.  **Auth:** Sử dụng Cookie `__Secure-next-auth.session-token` để gọi `GET /api/auth/session` -> Trả về `accessToken` (JWT).
2.  **Bảo mật (Bot Detection):** CỰC KỲ CAO.
    - Yêu cầu header `openai-sentinel-token`.
    - Yêu cầu `openai-sentinel-proof-token`.
    - Các token này được sinh ra bởi một hệ thống **Proof-of-Work bí mật**, chạy trong môi trường máy ảo (VM) bị làm rối (obfuscated) bằng WASM/JS, thay đổi liên tục.

### Chiến lược Tích hợp (Thực tế)

Do việc dịch ngược thuật toán `sentinel-token` là bất khả thi (và không bền vững), chúng ta sử dụng chiến lược **Native Input Simulation**.

1.  **Hidden Window:** Mở một cửa sổ ẩn `https://chatgpt.com`. Cửa sổ này tự động tải đầy đủ môi trường bảo mật (PoW, Fingerprinting).
2.  **Giả lập Nhập liệu (Native Input):**
    - Không dùng DOM Script (`value = ...`) vì React sẽ chặn (gây lỗi "Illegal Invocation").
    - Sử dụng `webContents.insertText(text)` của Electron. Lệnh này gửi sự kiện bàn phím cấp hệ điều hành (OS-level keypresses) vào ô input đang focus.
    - Cách này **không thể bị phát hiện** bởi script chống bot, vì nó giống hệt hành vi người dùng thật gõ phím.
3.  **Interceptor:** Monkey-patch `window.fetch` để bắt luồng dữ liệu trả về và gửi ngược lại Main Process.

---

## 4. Bảng So sánh Tổng hợp

| Đặc điểm                 | Claude         | DeepSeek             | ChatGPT                     |
| :----------------------- | :------------- | :------------------- | :-------------------------- |
| **Giao thức gốc**        | HTTPS (Cookie) | HTTPS (Bearer Token) | HTTPS (Bearer Token)        |
| **Độ khó Bảo mật**       | Thấp           | Cao (WASM PoW)       | **Cực Cao** (Sentinel PoW)  |
| **Phương pháp Tích hợp** | HTTP Request   | HTTP + WASM Module   | **Native Input Simulation** |
| **Yêu cầu Browser**      | Không          | Không                | **Có** (Hidden Window)      |
| **Khả năng Bị chặn**     | Thấp           | Trung bình           | Thấp (Do giả lập native)    |

### Kết luận

- **Claude:** Dễ nhất, chỉ cần Cookie.
- **DeepSeek:** Khó vừa, cần chạy WASM PoW.
- **ChatGPT:** Khó nhất nếu dùng API thuần. Giải pháp tối ưu là giả lập hành vi người dùng (Native Input) trên nền Hidden Window để tận dụng chính cơ chế bảo mật của OpenAI.
