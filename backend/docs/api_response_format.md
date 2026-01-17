# Chuẩn API Response Format

Tất cả các API endpoints đều tuân theo cấu trúc response chuẩn sau:

## Response Structure

### Success Response

```json
{
  "success": true,
  "message": "Mô tả kết quả",
  "data": {
    // Dữ liệu trả về
  },
  "meta": {
    "timestamp": "2026-01-17T12:00:00.000Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Mô tả lỗi",
  "error": {
    "code": "ERROR_CODE",
    "details": {
      // Chi tiết lỗi (optional)
    }
  },
  "meta": {
    "timestamp": "2026-01-17T12:00:00.000Z"
  }
}
```

## Error Codes

| Code | Status | Mô tả |
|------|--------|-------|
| `NOT_FOUND` | 404 | Resource không tồn tại hoặc endpoint không hợp lệ |
| `INVALID_INPUT` | 400 | Dữ liệu đầu vào không hợp lệ |
| `DATABASE_ERROR` | 500 | Lỗi database |
| `INTERNAL_ERROR` | 500 | Lỗi server nội bộ |

## Ví dụ

### 404 Error (Route không tồn tại)

```bash
GET /v1/accounts/import
```

Response:
```json
{
  "success": false,
  "message": "Cannot GET /v1/accounts/import",
  "error": {
    "code": "NOT_FOUND",
    "details": {
      "method": "GET",
      "path": "/v1/accounts/import"
    }
  },
  "meta": {
    "timestamp": "2026-01-17T12:00:00.000Z"
  }
}
```

### Validation Error

```bash
POST /v1/accounts/import
Content-Type: application/json

"not-an-array"
```

Response:
```json
{
  "success": false,
  "message": "Request body must be an array of accounts",
  "error": {
    "code": "INVALID_INPUT",
    "details": {
      "expected": "array",
      "received": "string"
    }
  },
  "meta": {
    "timestamp": "2026-01-17T12:00:00.000Z"
  }
}
```

### Success với dữ liệu

```bash
GET /v1/accounts?page=1&limit=10
```

Response:
```json
{
  "success": true,
  "message": "Accounts retrieved successfully",
  "data": {
    "accounts": [...],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "total_pages": 5
    }
  },
  "meta": {
    "timestamp": "2026-01-17T12:00:00.000Z"
  }
}
```
