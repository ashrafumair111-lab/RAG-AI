# Contributing to RAGent

Thanks for your interest in making RAGent better! 🚀

## Getting started

1. **Fork** the repository and create a feature branch.
2. Install dependencies — `backend/` and `frontend/` are separate npm projects:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Copy `.env.example` to `.env` and add your API keys for local testing.
4. Run the backend (`npm run dev` in `backend/`) and the frontend
   (`npm run dev` in `frontend/`) in two terminals.

## Development guidelines

- **TypeScript, strict mode.** Both packages compile with `strict: true` — keep it that way.
- **Every external service is optional.** The system must degrade gracefully
  (no MongoDB → in-memory store, no documents → web-only mode). Never throw at
  startup just because a service is missing.
- **Secrets stay local.** Never commit `.env` or paste real API keys into
  issues, PRs, or logs.
- **Keep the frontend self-contained.** The UI intentionally has zero UI
  dependencies — please don't introduce a CSS framework or component library.
- **Streaming contract.** If you touch `/api/chat`, preserve the SSE event
  contract (`status`, `sources`, `token`, `done`, `error`) used by the client.

## Pull requests

- Keep changes focused — one PR = one concern.
- Update the README and/or `.env.example` when you change configuration or endpoints.
- Verify with `npm run build` in both packages (CI runs the same checks).

## Questions?

Open a discussion or an issue before large refactors so we can align early.