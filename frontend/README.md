# RAGent Frontend

TypeScript + React + Vite UI for the RAGent backend (LangGraph RAG agent).

## Stack
- **React 18** + **TypeScript** (strict)
- **Vite 6** build tooling
- Zero UI dependencies — hand-rolled dark theme styles

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api and /health to :8000)
```

Start the backend first (see `backend/`). The dev server proxies all
`/api/*` and `/health` requests to `http://localhost:8000`.

Build for production:

```bash
npm run build
npm run preview    # serve the built `dist/`
```

## Structure

```
src/
  api/client.ts         # typed API client + SSE chat stream parser
  types.ts              # shared types mirroring backend contracts
  App.tsx               # app state: sessions, chat, documents, health
  components/
    Sidebar.tsx         # sessions, document uploads, health badges
    MessageList.tsx     # message thread + markdown-ish rendering + sources
    Composer.tsx        # input box (Enter to send)
    EmptyState.tsx      # landing / new-chat
  styles.css            # all styling
```