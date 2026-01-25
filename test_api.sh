#!/bin/bash

# Script test API endpoint
# Chuyển đổi từ Python code được cung cấp

echo "Đang gửi request đến http://127.0.0.1:8045/v1/chat/completions..."

# Gửi request và lưu response
response=$(curl -s -X POST "http://127.0.0.1:8045/v1/chat/completions" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer sk-9f097169d1844139b1dc6a458e9d1386" \
     -d '{
           "model": "gemini-3-pro-high",
           "messages": [{"role": "user", "content": "Hello"}]
         }')

# Kiểm tra nếu response là JSON hợp lệ thì dùng jq, không thì in nguyên bản
if command -v jq &> /dev/null && echo "$response" | jq . >/dev/null 2>&1; then
    echo "$response" | jq
else
    echo "Response (Raw):"
    echo "$response"
fi
