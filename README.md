<p align="center">
  <img src="build/icon.png" alt="Elara Logo" width="128" height="128">
</p>

<h1 align="center">Elara</h1>

<p align="center">
  <strong>🚀 AI-powered developer productivity desktop app with CLI integration</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#cli">CLI</a> •
  <a href="#api-documentation">API</a> •
  <a href="#development">Development</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-28.1.0-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.3.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License">
</p>

---

## ✨ Features

- **🤖 AI-Powered Commands** - Integrate with multiple AI providers (DeepSeek, Claude) for intelligent assistance
- **📝 Commit Message Generator** - Automatically generate conventional commit messages from staged changes
- **🔌 CLI Integration** - Powerful command-line interface accessible from anywhere
- **🖥️ Cross-Platform** - Available for Windows, macOS, and Linux
- **🎨 Modern UI** - Beautiful interface built with React, TailwindCSS, and Monaco Editor
- **🔄 System Tray** - Runs in background with quick access from system tray
- **📊 Account Management** - Manage multiple AI provider accounts

## 📦 Installation

### Download Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/KhanhRomVN/Elara/releases) page.

| Platform | Format                               |
| -------- | ------------------------------------ |
| Windows  | `.exe` (NSIS Installer), `.msi`      |
| macOS    | `.dmg`                               |
| Linux    | `.AppImage`, `.deb`, `.rpm`, `.snap` |

### Install via npm

```bash
npm install -g elara
```

## 🚀 Usage

### Desktop Application

1. Launch Elara from your applications menu or dock
2. Add your AI provider accounts in the Accounts page
3. Use the Playground to interact with AI models
4. Access commands through the Commands page

### CLI

The CLI allows you to use Elara commands directly from your terminal.

```bash
# Check Elara status
elara

# Generate commit message from staged changes
elara commit-message
```

> **Note:** The desktop app must be running for CLI commands to work.

## 📖 API Documentation

Elara provides a powerful embedded server API for programmatic access to AI providers, account management, and messaging capabilities.

**[📚 View Full API Documentation →](API_DOCUMENTATION.md)**

### Quick Example

## Configuration

The backend port can be configured via `.env` file in the root directory:

```bash
VITE_BACKEND_PORT=8888
```

## API Usage

```bash
# Get all accounts
curl "http://localhost:8888/v1/accounts"

# Send a message
curl -X POST "http://localhost:8888/v1/chat/accounts/ACC_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Hello!"}]}'
```

The embedded server runs on `http://localhost:8888` and provides endpoints for:

- 🔐 Account Management
- 🤖 Model Discovery
- 💬 Chat & Messaging
- 📜 Conversation History

## 🛠️ Development

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Setup

```bash
# Clone the repository
git clone https://github.com/KhanhRomVN/Elara.git
cd Elara

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Script                | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Start development server with hot reload |
| `npm run build`       | Build for production (Windows & Linux)   |
| `npm run build:win`   | Build for Windows only                   |
| `npm run build:mac`   | Build for macOS only                     |
| `npm run build:linux` | Build for Linux only                     |
| `npm run lint`        | Run ESLint                               |
| `npm run format`      | Format code with Prettier                |
| `npm run test`        | Run tests                                |

### Project Structure

```
elara/
├── bin/                    # CLI client
├── build/                  # Build resources (icons, etc.)
├── docs/                   # Documentation
├── src/
│   ├── main/              # Electron main process
│   │   ├── core/          # Core functionality (window, tray, CLI server)
│   │   ├── ipc/           # IPC handlers
│   │   └── server/        # Local API server
│   ├── preload/           # Preload scripts
│   └── renderer/          # React frontend
│       └── src/
│           ├── core/      # Core components
│           ├── features/  # Feature modules
│           └── styles/    # Global styles
└── scripts/               # Build & setup scripts
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**KhanhRomVN**

- GitHub: [@KhanhRomVN](https://github.com/KhanhRomVN)

---

<p align="center">
  Made with ❤️ by KhanhRomVN
</p>
