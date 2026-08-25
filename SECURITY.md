# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report privately by
creating a GitHub Security Advisory on this repository (or via private e-mail to
the maintainers listed on your repository's contact).

When reporting, include:

- A short description of the issue and its impact.
- Steps to reproduce (keep it minimal).
- Affected versions.

You will receive an acknowledgement within 72 hours and, once confirmed, a
timeline for the fix and disclosure.

## Safe-handling guidelines

- **Never commit real API keys.** All secrets live in a git-ignored `.env`.
  Use [`.env.example`](.env.example) as the template for anything new.
- **Uploaded files are untrusted input.** Parsing happens in memory only
  (see `backend/src/rag/ingest.ts`); no upload is ever written to disk.
- **The API is currently unauthenticated.** Before exposing the backend
  publicly, put an authenticating reverse proxy in front of it (nginx +
  basic auth, Caddy, etc.).

## Scope

Known platform-level risks that are handled on a case-by-case basis:

- Prompt-injection through ingested documents or web-retrieved content.
- Very large uploads (a 15 MB per-file cap is enforced; parse CPU is bounded).