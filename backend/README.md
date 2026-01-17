# Elara Backend

Backend service for Elara - AI-powered developer productivity app.

## Architecture

```
backend/
├── src/
│   ├── config/       # Server and provider configurations
│   ├── constants/    # Application constants
│   ├── middleware/   # Express middleware
│   ├── services/     # Business logic layer
│   ├── controllers/  # Request handlers
│   ├── routes/       # API route definitions
│   ├── utils/        # Helper utilities
│   ├── types/        # TypeScript type definitions
│   ├── validators/   # Request validators
│   ├── app.ts        # Express app initialization
│   └── server.ts     # Server entry point
└── tsconfig.json     # TypeScript configuration
```

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Integration**: Bundled with Electron main process

## Development

This backend is compiled and bundled together with the Electron app. It runs as part of the main process and is not a standalone service.

## API Endpoints

- `/health` - Health check endpoint
- `/v0/management/*` - Management API routes
- `/v1/*` - Application API routes (chat, models, providers)

## Communication Pattern

UI (Renderer) → IPC (Electron) → Backend Express Server (localhost:port)
