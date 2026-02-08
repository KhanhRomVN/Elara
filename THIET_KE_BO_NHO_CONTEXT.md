# Thiết Kế Chi Tiết Context Tool Offline: Bộ Nhớ Ngắn & Dài Hạn

Tài liệu này là bản thiết kế hoàn chỉnh nhất cho **Hệ Thống Quản Lý Ngữ Cảnh (Context Tool)** hoạt động offline trên máy người dùng.

Hệ thống được thiết kế để giải quyết 3 vấn đề cốt lõi:

1.  **Memory Limit**: Vượt qua giới hạn context (50K token) bằng cơ chế "Continuous Rolling".
2.  **Multi-Model**: Hỗ trợ chuyển đổi model AI linh hoạt mà không mất mạch làm việc.
3.  **Performance**: Không làm chậm thao tác chat nhờ kiến trúc Async Queue & Worker.

---

## 1. Kiến Trúc Tổng Quan (High-Level Architecture)

Chúng ta sử dụng mô hình **Centralized Storage (Lưu Trữ Tập Trung)** để quản lý dữ liệu context, giúp tách biệt hoàn toàn dữ liệu metadata khỏi source code dự án.

### 1.1 Vị Trí Lưu Trữ

Toàn bộ dữ liệu nằm tại thư mục gốc của người dùng:

- **Linux/macOS**: `~/.context_tool_data/`
- **Windows**: `%USERPROFILE%\.context_tool_data\`

### 1.2 Cấu Trúc Thư Mục Chi Tiết

```
~/.context_tool_data/
├── root.json                # [CORE] File Index quản lý danh sách Project (O(1) Lookup)
├── global_config.json       # Cấu hình chung (API Keys, Theme, Sync Settings)
├── worker_queue/            # Folder chứa file lock/queue tạm cho Background Worker
└── projects/                # Nơi chứa dữ liệu thực tế của từng Project
    ├── <project_hash_id_1>/ # ID = MD5(AbsolutePath)
    │   ├── db/
    │   │   ├── codebase.lance      # [Layer 1] Codebase Brain: Vector + Metadata
    │   │   ├── codebase_graph.json # [Layer 1] Codebase Brain: Graph Relationship
    │   │   └── user_memory.lance   # [Layer 2] User Heart: Facts & Preferences
    │   ├── active_session/
    │   │   ├── current_summary.md  # [Layer 2] Context ngắn hạn
    │   │   ├── chat_log.json       # Raw logs
    │   │   └── active_tasks.json   # Auto-detected Tasks
    │   └── archives/               # Lưu trữ session cũ
    └── ...
```

---

## 2. Các Thành Phần Cốt Lõi (Core Components)

Hệ thống được tổ chức thành 3 lớp (Layers) chính, kết hợp sức mạnh của Vector Search và Graph Relationship:

### 2.1 Layer 1: Codebase Brain (Xương Sống - Cognee Style)

_Mục tiêu: Hiểu sâu cấu trúc mã nguồn tĩnh (Static Analysis)._

- **Graph-based Indexing**:
  - Thay vì chỉ lưu văn bản, hệ thống lưu **Nodes** (File, Class, Function) và **Edges** (Imports, Calls, Inherits).
  - Sử dụng `ts-morph` (TypeScript) hoặc `Tree-sitter` để trích xuất cấu trúc này _trước khi_ embedding.
  - **Lợi ích**: Hỗ trợ Deep Retrieval (Ví dụ: Tìm tất cả hàm gọi đến `AuthService.login`) chính xác hơn vector search thuần túy.
- **Pipeline Xử Lý**:
  - `Ingestion` -> `Static Analysis` -> `Graph Extraction` -> `Embedding` -> `Storage`.

### 2.2 Layer 2: User Heart (Trái Tim - Mem0 Style)

_Mục tiêu: Cá nhân hóa và học hỏi từ người dùng (Dynamic Context)._

- **Fact Extraction (Trích Xuất Sự Kiện)**:
  - Background Worker sử dụng LLM nhỏ để trích xuất "Facts" từ hội thoại thay vì lưu raw text.
  - Ví dụ: User chat "Đừng dùng arrow function ở đây", hệ thống lưu Fact: `preference: no_arrow_function_in_context`.
- **Memory Lifecycle**:
  - Tự động **Add/Update/Delete** facts dựa trên độ mới và độ mâu thuẫn của thông tin.
- **Hybrid Search**:
  - Khi Query, hệ thống tìm kiếm song song: `Codebase Brain` (Kiến thức dự án) + `User Heart` (Sở thích/Context User) -> Tổng hợp câu trả lời.

### 2.3 Layer 3: Interaction Face (Giao Diện - Memora Style)

_Mục tiêu: Trực quan hóa và Bảo mật._

- **Visualization**: Tích hợp server nội bộ hiển thị Graph dự án (`ctx visualize`).
- **Security**: Tự động Redact (che) API Key/Secret bằng Regex trước khi lưu vào DB.

---

## 3. Cơ Chế Hoạt Động Đặc Biệt (Key Mechanisms)

### 3.1 Smart Indexing (Non-Invasive)

Để tránh index file rác mà KHÔNG tạo file cấu hình trong project:

#### Lớp 1: Hard-coded Exclusion (Loại bỏ triệt để)

Tự động bỏ qua các file không phải Plain-Text (không đọc được bằng Text Editor thông thường):

- **Document**: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`.
- **Media**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.ico`, `.mp4`, `.mp3`, `.wav`.
- **Binary/Archive**: `.exe`, `.dll`, `.so`, `.bin`, `.zip`, `.tar`, `.gz`, `.7z`, `.rar`.
- **System/Build**: `node_modules`, `.git`, `.svn`, `dist`, `build`, `out`, `coverage`.

#### Lớp 2: Git-aware

Tự tìm đọc `.gitignore` (nếu có) và tuân thủ nó.

#### Lớp 3: Heuristics & Content Analysis (Phân tích nội dung)

Trước khi Index, tool sẽ đọc thử file để kiểm tra:

- **Kiểm tra Binary**: Nếu phát hiện ký tự NULL (`\0`) trong 1024 bytes đầu -> Coi là Binary -> **Bỏ qua**.
- **Kiểm tra Minified**: Nếu tỷ lệ (Số ký tự / Số dòng) quá lớn (ví dụ: 1 dòng dài > 3000 ký tự) -> Coi là Minified Code -> **Bỏ qua**.
- **Kiểm tra Size**: File > 1MB (Text Code hiếm khi lớn hơn mức này) -> **Bỏ qua**.

#### Lớp 4: Centralized Config

Nếu muốn ignore thêm, User cấu hình trong `~/.context_tool_data/root.json`.

---

### 3.2 Continuous Context Update (Cập Nhật Liên Tục)

Thay vì chờ hết token mới tóm tắt (dễ gây lỗi mất dữ liệu), hệ thống hoạt động theo nguyên tắc **"Always Fresh"**:

1.  **User**: Gửi câu hỏi -> **AI**: Trả lời.
2.  **Immediate Action**: Đẩy cặp {Hỏi - Trả lời} vào **Queue**.
3.  **Background Worker**:
    - Lấy job từ Queue.
    - Dùng một **Small Model** (Gemini Flash / Gemma 2B) để đọc hội thoại vừa rồi.
    - **Update Summary**: Cập nhật file `current_summary.md`.
    - **Update Tasks**: Đánh dấu task trong `active_tasks.json` là hoàn thành/đang làm.
    - **Fact Extraction**: Trích xuất thông tin mới (Facts) -> Lưu vào `user_memory.lance` (User Heart).

### 3.3 Context Rolling (Cuộn Ngữ Cảnh)

Giải quyết giới hạn 50K token hoặc khi đổi Model:

1.  **Trigger**: Token count > Limit HOẶC User đổi Model.
2.  **Reset**: Xóa sạch `chat_log.json` (Raw text).
3.  **Inject**: Khởi tạo phiên mới với Context đầu vào là `current_summary.md`.

---

## 4. Đặc Tả `root.json` (Project Registry)

File này giúp hệ thống khởi động cực nhanh (O(1) Access).

```json
{
  "version": "1.0",
  "projects": [
    {
      "id": "a1b2c3...",
      "name": "SuperApp",
      "path": "/home/user/super-app",
      "lastUsed": 1716200000000,
      "stats": { "files": 150, "contextSize": 12000 },
      "indexing": {
        "exclude": ["src/legacy/**"] // Cấu hình ignore tại đây
      }
    }
  ]
}
```

---

## 5. Công Nghệ Đề Xuất (Recommended Tech Stack)

| Thành Phần          | Công Nghệ / Thư Viện      | Lý Do                                           |
| :------------------ | :------------------------ | :---------------------------------------------- |
| **Language**        | **TypeScript (Node.js)**  | Hệ sinh thái mạnh, dễ maintain.                 |
| **Embedding**       | **Gemini Output API**     | Chất lượng cao, chi phí thấp/free.              |
| **Vector DB**       | **LanceDB** (Node)        | Serverless, chạy file local, nhanh hơn SQLite.  |
| **Graph DB**        | **Adjacency List (JSON)** | Lite Graph, không cần setup Neo4j phức tạp.     |
| **Static Analysis** | **ts-morph**              | Phân tích mã nguồn TypeScript (AST) chính xác.  |
| **Visualization**   | **vis-network**           | Vẽ biểu đồ tương tác trên trình duyệt.          |
| **Queue**           | **FastQ** / **BullMQ**    | Quản lý Worker xử lý background.                |
| **File Watcher**    | **Chokidar**              | Theo dõi thay đổi file code.                    |
| **Binary Check**    | **isbinaryfile**          | Thư viện NodeJS kiểm tra file binary heuristic. |
| **CLI Framework**   | **Commander.js**          | Xây dựng giao diện dòng lệnh.                   |

---

## 6. Tổng Kết Workflow Người Dùng

1.  **Start**: `ctx start` -> Tool chạy ngầm, load context.
2.  **Chat**: User chat với AI qua giao diện (CLI/Extension).
3.  **Process**:
    - Tool search Vector DB (Code + History).
    - Tool lấy Summary mới nhất.
    - Ghép thành Prompt -> Gửi AI.
4.  **Update**:
    - Worker ngầm tóm tắt hội thoại -> Update Summary.
    - Index code mới nếu User sửa file.
5.  **Finish**: Khi tắt, mọi thứ đã được lưu. Không cần thao tác "Save".
