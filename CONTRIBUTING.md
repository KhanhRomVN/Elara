# Contributing to Elara

Thank you for your interest in contributing to Elara! 🎉

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- Git

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/Elara.git
cd Elara

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📝 How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/KhanhRomVN/Elara/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - System information (OS, Node version, etc.)

### Suggesting Features

1. Open a new issue with the `enhancement` label
2. Describe the feature and its use case
3. Explain why it would be valuable

### Submitting Pull Requests

1. **Fork** the repository
2. **Create a branch** for your feature:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** following our code standards
4. **Run tests and linting**:
   ```bash
   npm run lint
   npm run test
   ```
5. **Commit** with conventional commit messages:
   ```bash
   git commit -m "✨ feat: add amazing feature"
   ```
6. **Push** to your fork:
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

## 📋 Code Standards

### Commit Messages

We use conventional commits with emojis:

| Emoji | Type       | Description        |
| ----- | ---------- | ------------------ |
| ✨    | `feat`     | New feature        |
| 🐛    | `fix`      | Bug fix            |
| 📝    | `docs`     | Documentation      |
| 💄    | `style`    | UI/styling changes |
| ♻️    | `refactor` | Code refactoring   |
| 🧪    | `test`     | Adding tests       |
| 🔧    | `chore`    | Maintenance        |

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write meaningful variable and function names
- Add comments for complex logic

### Testing

- Write tests for new features
- Ensure existing tests pass before submitting PRs

## 🏗️ Project Structure

```
src/
├── main/          # Electron main process
├── preload/       # Preload scripts
└── renderer/      # React frontend
```

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 💬 Questions?

Feel free to open an issue or reach out to [@KhanhRomVN](https://github.com/KhanhRomVN).

---

Thank you for contributing! 🙏
