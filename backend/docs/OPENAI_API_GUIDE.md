Tài liệu này hướng dẫn cách tích hợp và sử dụng các tính năng quan trọng nhất của OpenAI API.

1. Cấu hình Cơ bản (Authentication)

Tất cả các request đều yêu cầu Header Authorization.

Base URL: https://api.openai.com/v1

Headers:

code
JSON
download
content_copy
expand_less
{
  "Authorization": "Bearer YOUR_OPENAI_API_KEY",
  "Content-Type": "application/json"
}
2. Chat Completions API (Stateless)

Đây là cách phổ biến nhất. API này không lưu lịch sử, bạn phải tự gửi lại các tin nhắn cũ để duy trì ngữ cảnh.

Request Body

Endpoint: POST /chat/completions

Các tham số quan trọng:

model: ID của model (ví dụ: gpt-4o, gpt-3.5-turbo).

messages: Danh sách các tin nhắn.

temperature: Độ sáng tạo (0.0 đến 2.0).

stream: true/false (trả về từng phần hay trả về một lần).

Cấu trúc Tin nhắn (Roles)

system: Cấu hình hành vi/tính cách của trợ lý.

user: Tin nhắn từ người dùng.

assistant: Câu trả lời trước đó của AI.

Ví dụ Request (Có ngữ cảnh):
code
JSON
download
content_copy
expand_less
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "Bạn là giáo viên toán."},
    {"role": "user", "content": "Chào thầy, em là An."},
    {"role": "assistant", "content": "Chào An, hôm nay em muốn học gì?"},
    {"role": "user", "content": "Tên em là gì?"}
  ]
}
3. Chế độ Streaming

Khi dùng stream: true, API sẽ trả về các Event-Stream (SSE). Mỗi chunk có cấu trúc:

code
Text
download
content_copy
expand_less
data: {"id":"...","choices":[{"index":0,"delta":{"content":"Chào"},"finish_reason":null}]}

data: {"id":"...","choices":[{"index":0,"delta":{"content":" bạn"},"finish_reason":null}]}

data: [DONE]

Lưu ý: Bạn cần dùng một thư viện hỗ trợ stream hoặc xử lý luồng dữ liệu theo thời gian thực ở frontend.

4. Assistants API (Stateful - Quản lý Conversation)

Dùng khi bạn muốn OpenAI tự lưu trữ lịch sử cuộc trò chuyện (Threads).

Bước 1: Tạo một Assistant (Chỉ cần làm 1 lần)

POST /assistants

code
JSON
download
content_copy
expand_less
{
  "instructions": "Bạn là một hỗ trợ viên kỹ thuật.",
  "name": "Technical Helper",
  "model": "gpt-4o"
}
Bước 2: Tạo Thread (Tạo một Conversation mới)

POST /threads

Response: Trả về một thread_id. Lưu ID này để dùng cho cả cuộc hội thoại.

Bước 3: Thêm tin nhắn vào Thread

POST /threads/{thread_id}/messages

code
JSON
download
content_copy
expand_less
{
  "role": "user",
  "content": "Lỗi 404 là gì?"
}
Bước 4: Chạy Assistant (Run)

POST /threads/{thread_id}/runs

code
JSON
download
content_copy
expand_less
{
  "assistant_id": "asst_abc123"
}

Lưu ý: Với Assistants API, bạn cần poll (kiểm tra liên tục) trạng thái của Run cho đến khi nó completed, sau đó mới lấy tin nhắn mới nhất bằng GET /threads/{thread_id}/messages.

5. Các tính năng khác
Image Generation (DALL-E 3)

Endpoint: POST /images/generations

Body: {"prompt": "Một con mèo máy biết bay", "n": 1, "size": "1024x1024"}

Audio (Speech-to-Text & Text-to-Speech)

Whisper (STT): POST /audio/transcriptions (Upload file âm thanh để lấy văn bản).

TTS: POST /audio/speech (Gửi văn bản để nhận file mp3).

6. Quản lý Token và Chi phí

Token Limit: Mỗi model có giới hạn (Context Window). Ví dụ GPT-4o là 128,000 tokens.

Cách tính: 1000 tokens ≈ 750 từ tiếng Anh.

Mẹo tiết kiệm:

Giới hạn lịch sử chat (chỉ gửi 5-10 tin nhắn gần nhất).

Sử dụng max_tokens để giới hạn độ dài câu trả lời.

7. Mã lỗi phổ biến (Error Codes)

401: API Key sai hoặc hết hạn.

429: Quá hạn mức (Rate limit) hoặc hết tiền trong tài khoản.

500: Lỗi hệ thống từ OpenAI.

Mẫu Code Python nhanh (Dùng thư viện openai)
code
Python
download
content_copy
expand_less
from openai import OpenAI

client = OpenAI(api_key="YOUR_KEY")

# Chat thường
response = client.chat.completions.create(
  model="gpt-4o",
  messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)

# Chat stream
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Viết một bài thơ dài"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
