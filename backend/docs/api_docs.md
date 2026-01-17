# Tài liệu API Quản lý Tài khoản (Account Management)

Dưới đây là mô tả chi tiết cho các API quản lý tài khoản hiện có.

## 1. Import Tài khoản (Bulk Import)

Dùng để thêm mới hoặc cập nhật thông tin tài khoản vào hệ thống.

- **URL:** `/v1/accounts/import`
- **Method:** `POST`
- **Headers:**
    - `Content-Type: application/json`
- **Body:** Mảng JSON chứa danh sách các tài khoản.

```json
[
  {
    "id": "uuid-string",
    "provider_id": "tên-provider", // ví dụ: deepseek, claude
    "email": "user@gmail.com",
    "credential": "chuỗi-credential"
  },
  // ...
]
```

- **Phản hồi thành công (200 OK):**

```json
{
  "message": "Successfully imported X accounts",
  "imported": 5,
  "skipped": 2,
  "duplicates": [
    {
      "email": "user@gmail.com",
      "provider_id": "deepseek"
    }
  ]
}
```

**Lưu ý:** Nếu tài khoản có cùng `email` và `provider_id` đã tồn tại, nó sẽ bị bỏ qua và được liệt kê trong mảng `duplicates`.

## 2. Lấy danh sách Tài khoản (Get Accounts)

Lấy danh sách tài khoản với hỗ trợ phân trang, lọc và sắp xếp.

- **URL:** `/v1/accounts`
- **Method:** `GET`
- **Query Parameters (Tham số):**

| Tham số      | Kiểu dữ liệu | Mặc định | Mô tả |
| :---         | :---         | :---     | :--- |
| `page`       | `number`     | `1`      | Số trang cần lấy. |
| `limit`      | `number`     | `10`     | Số lượng bản ghi trên mỗi trang. |
| `email`      | `string`     | `null`   | Lọc theo email (tìm kiếm gần đúng). |
| `provider_id`| `string`     | `null`   | Lọc theo ID của nhà cung cấp (tìm kiếm chính xác). |
| `sort_by`    | `string`     | `email`  | Trường để sắp xếp. Giá trị: `email` hoặc `provider_id`. |
| `order`      | `string`     | `asc`    | Hướng sắp xếp. Giá trị: `asc` (tăng dần) hoặc `desc` (giảm dần). |

- **Ví dụ Request:**

```
GET /v1/accounts?page=1&limit=5&provider_id=claude&sort_by=email&order=desc
```

- **Phản hồi thành công (200 OK):**

```json
{
  "data": [
    {
      "id": "uuid-string",
      "provider_id": "claude",
      "email": "user@gmail.com",
      "credential": "..."
    }
  ],
  "meta": {
    "total": 50,          // Tổng số bản ghi tìm thấy
    "page": 1,            // Trang hiện tại
    "limit": 5,           // Giới hạn mỗi trang
    "total_pages": 10     // Tổng số trang
  }
}
```
