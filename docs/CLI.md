# Elara CLI

Command-line interface để kiểm tra trạng thái Elara app.

## Quick Start

### Development (Recommended)

```bash
# Auto-setup khi chạy dev
npm run dev

# Sử dụng CLI
npx elara
```

### Global Installation

```bash
# Cài một lần
sudo npm run install-cli

# Sử dụng từ mọi nơi
elara
```

## Features

✨ **Auto Hot Reload**

- CLI tự động update khi code thay đổi
- Không cần restart hay reinstall
- Works với cả `npx elara` và `elara`

📊 **App Information**

- Application name & version
- Process ID (PID)
- Uptime
- Platform & architecture
- Node & Electron versions
- Memory usage (RSS, Heap)

🎨 **Beautiful Output**

- Colorful display với borders
- Clear status indicators
- User-friendly error messages

## Usage

```bash
# Local (trong project)
npx elara

# Global (mọi nơi)
elara

# Direct
node bin/cli.js
```

## Development

### File Structure

```
bin/
  cli.js              # CLI client (connects to app)
src/main/core/
  cli-server.ts       # CLI server (runs in app)
scripts/
  dev-setup.js        # Auto-setup script
  install-cli.js      # Global install script
  uninstall-cli.js    # Uninstall script
```

### How It Works

1. **App starts** → Creates Unix socket at `/tmp/elara.sock`
2. **User runs CLI** → Connects to socket
3. **CLI sends "info" request** → Server responds with app data
4. **CLI displays** → Beautiful formatted output

### Hot Reload

**Server** (`src/main/core/cli-server.ts`):

- Electron-vite auto-restarts main process on changes

**Client** (`bin/cli.js`):

- Symlink points to source file
- Changes take effect immediately

**No manual update needed!**

## Commands

```bash
# Setup local CLI
npm run setup-cli

# Install globally
sudo npm run install-cli

# Uninstall global
sudo npm run uninstall-cli
```

## Documentation

See [cli-usage.md](file:///home/khanhromvn/.gemini/antigravity/brain/3283b1d9-cc81-4f44-96c0-22865782ab86/cli-usage.md) for detailed usage guide.
