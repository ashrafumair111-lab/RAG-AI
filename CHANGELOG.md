# Changelog

All notable changes to **RAGent** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/) and this
project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-08-25

### Added

- LangGraph agent graph: `router → retrieve → web_search → generate → check`
  with a self-correction loop for ungrounded answers.
- Hybrid retrieval: Qdrant vector search + Cohere Rerank v3.5 over the user's
  documents, Tavily live web search, and intent-based routing (`vector` | `web` | `hybrid`).
- Document ingestion pipeline for PDF / TXT / MD (chunk → embed → index) with
  per-document deletion.
- Token-streaming chat over Server-Sent Events, including agent phase and
  cited-source events.
- MongoDB persistence for sessions, message history, and document metadata,
  with an automatic in-memory fallback when MongoDB is unavailable.
- React 18 + Vite dark-mode chat UI: session manager, drag-and-drop knowledge
  base, dependency health panel, and cited-source rendering.
- `/health` endpoint reporting per-dependency status (Groq · Tavily · Cohere · Qdrant · MongoDB).
- Open-source release: MIT license, CI pipeline, security & contributing docs.