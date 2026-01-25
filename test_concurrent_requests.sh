#!/bin/bash

# Test concurrent requests to Antigravity API
# This script sends multiple requests simultaneously to test rate limiting

ACCOUNT_ID="77204028-1e63-4c8d-b191-20705e2c5e25"
BASE_URL="http://localhost:11434"
NUM_REQUESTS=5

echo "=========================================="
echo "Testing Concurrent Requests to Antigravity"
echo "Account: $ACCOUNT_ID"
echo "Number of concurrent requests: $NUM_REQUESTS"
echo "=========================================="
echo ""

# Function to send a single request
send_request() {
  local request_num=$1
  local start_time=$(date +%s.%N)
  
  echo "[$request_num] Sending request at $(date +%H:%M:%S.%N)"
  
  response=$(curl -s -w "\n%{http_code}" -X POST \
    "$BASE_URL/v1/chat/accounts/messages" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3-flash",
      "accountId": "'$ACCOUNT_ID'",
      "messages": [
        {
          "role": "user",
          "content": "Test request #'$request_num'"
        }
      ],
      "conversationId": "",
      "stream": false,
      "thinking": false
    }')
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  local end_time=$(date +%s.%N)
  local duration=$(echo "$end_time - $start_time" | bc)
  
  if [ "$http_code" = "200" ]; then
    echo "[$request_num] ✅ SUCCESS - Duration: ${duration}s - Response: $(echo $body | jq -r '.message.content' 2>/dev/null || echo 'OK')"
  else
    echo "[$request_num] ❌ FAILED - HTTP $http_code - Duration: ${duration}s"
    echo "[$request_num] Error: $(echo $body | jq -r '.error.message' 2>/dev/null || echo $body)"
  fi
  
  echo ""
}

# Send requests concurrently in background
echo "Starting $NUM_REQUESTS concurrent requests..."
echo ""

for i in $(seq 1 $NUM_REQUESTS); do
  send_request $i &
done

# Wait for all background jobs to complete
wait

echo "=========================================="
echo "All requests completed!"
echo "=========================================="
