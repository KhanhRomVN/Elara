#!/bin/bash

# Script to automatically analyze Gemini captures and verify tokens
# Mọi phản hồi đều phải dùng tiếng việt

CAPTURE_FILE="/home/khanhromvn/Documents/Coding/Elara/https-requests-Gemini.json"
HTML_FILE="/home/khanhromvn/Documents/Coding/Elara/temp/alo/gemini/gemini-snlm0e.md"

echo "=== Đang phân tích HTML để trích xuất tokens khởi tạo ==="

# Extract bl (backend label) - search for boq_assistant directly
BL=$(grep -o 'boq_assistant-bard-web-server_[0-9.]*_p[0-9]' "$HTML_FILE" | head -n 1)
echo "[HTML] Backend Label (bl): $BL"

# Extract at (SNlM0e) - look for SNlM0e value (handle possible backslash quotes)
AT=$(grep -o 'SNlM0e\\*":\\*"[^\\"]*\\*"' "$HTML_FILE" | head -n 1 | sed 's/.*":"//;s/\\"//g;s/"//g')
echo "[HTML] SNlM0e (at): $AT"

# Extract sid (FdrFJe)
SID=$(grep -o 'FdrFJe\\*":\\*"[^\\"]*\\*"' "$HTML_FILE" | head -n 1 | sed 's/.*":"//;s/\\"//g;s/"//g')
echo "[HTML] FdrFJe (sid): $SID"

echo ""
echo "=== Đang phân tích file capture để theo dõi chuỗi opaque (cfb2h) ==="

# Find all StreamGenerate requests and extract their f.req opaque strings
grep -n "StreamGenerate" "$CAPTURE_FILE" | while read -r line; do
    LINE_NUM=$(echo "$line" | cut -d: -f1)
    # Extract the token starting with ! inside the request body
    OPAQUE=$(sed -n "${LINE_NUM},$(($LINE_NUM + 150))p" "$CAPTURE_FILE" | grep -o '![A-Za-z0-9_-]\{20,\}' | head -n 1)

    if [ ! -z "$OPAQUE" ]; then
        # Try to find user message nearby to identify the turn
        MSG=$(sed -n "$(($LINE_NUM - 20)),$(($LINE_NUM + 200))p" "$CAPTURE_FILE" | grep -o '"xin chào [0-9]"' | head -n 1)
        echo "[Line $LINE_NUM] Turn $MSG -> Token: ${OPAQUE:0:20}..."
    fi
done

echo ""
echo "=== Kiểm tra cấu trúc Payload trong GeminiProvider.ts ==="
# Kiểm tra các vị trí quan quan trọng trong mảng innerReq
grep -nE "innerReq = \[|Message|Language|Session|Opaque State String|Model Selection|Timestamp|Client UUID" /home/khanhromvn/Documents/Coding/Elara/backend/src/provider/gemini/provider.ts | head -n 20

echo ""
echo "=== Phân tích hoàn tất ==="
