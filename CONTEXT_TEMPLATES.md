# Proposal for Workspace Context Templates

This document is used to discuss and agree on the template structure for the two context files that Elara uses to understand a project.

---

## 1. Template for `workspace.md`

**Goal:** Provide a high-level overview of the project, helping the AI understand "What is this project?".

### Proposed Structure:

```markdown
# [Project Name]

## 🎯 Project Goals

- [Brief description of the product/app]
- [Target audience]

## 🛠 Tech Stack

- **Frontend:** [React, Next.js, Vite, etc.]
- **Styling:** [Vanilla CSS, Tailwind, CSS Modules, etc.]
- **Backend:** [Node.js, Express, Go, etc.]
- **Database:** [PostgreSQL, MongoDB, SQLite, etc.]
- **Others:** [Redis, Docker, etc.]

## 🚀 Key Features

- [ ] Feature A: [Description]
- [ ] Feature B: [Description]

## 📂 Directory Structure (High-level)

- `src/components`: Shared UI components.
- `src/hooks`: Custom hooks for logic.
- `src/services`: API communication and business logic.
```

---

## 2. Template for `workspace_rules.md`

**Goal:** Define coding standards and specific rules the AI must follow when making suggestions.

### Proposed Structure:

```markdown
# Project Rules & Conventions

## 💻 Coding Standards

- Language: Prefer [TypeScript/JavaScript].
- Naming Convention: [camelCase for variables, PascalCase for Components].
- File Structure: [One component per file, styles in index.css].

## 🎨 Styling Rules

- Always use [Vanilla CSS / Tailwind].
- No inline styles unless absolutely necessary.
- Color Palette: [Primary: #xxxxxx, Secondary: #yyyyyy].

## 🤖 Agent Instructions

- Always ask before making major architectural changes.
- Respond in Vietnamese (as per system preference).
- Clearly explain the rationale behind solutions.

## 📦 Git & Commit Rules

- Commit format: `type(scope): description` (e.g., `feat(auth): add login flow`).
```

---

## Discussion Questions:

1. Would you like to add a **Third-party libraries** section to `workspace.md`?
2. Should we include detailed **Error Handling** rules in `workspace_rules.md`?
3. Is this structure comprehensive enough for your current projects?
