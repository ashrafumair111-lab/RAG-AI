import dotenv from "dotenv";
import path from "path";

// Load .env from project root (two levels up from src/ or dist/).
// override: .env is authoritative — wins over any stale process-level
// env vars (e.g. a stale MONGODB_url in the user session) on this machine.
dotenv.config({ path: path.resolve(__dirname, "../..", ".env"), override: true });

/**
 * Central configuration for RAGent backend.
 * All secrets come from the project-root .env file.
 */
export const config = {
  port: Number(process.env.PORT || 5000),

  // ── LLM (Groq) ────────────────────────────────────────────────
  groqApiKey: process.env.GROQ_API_KEY || "",
  // NOTE: This key's account exposes a restricted model set (no
  // llama-3.x). Use the models the key can actually access.
  chatModel: "openai/gpt-oss-120b", // main answer generation
  fastModel: "openai/gpt-oss-20b", // routing + self-check (cheap/fast)

  // ── Web search (Tavily) ───────────────────────────────────────
  tavilyApiKey: process.env.TAVILY_API_KEY || "",

  // ── Embeddings + Reranking (Cohere) ───────────────────────────
  cohereApiKey: process.env.COHERE_API_KEY || "",
  embedModel: "embed-english-v3.0",
  embedDim: 1024,
  rerankModel: "rerank-v3.5",

  // ── Vector DB (Qdrant Cloud) ──────────────────────────────────
  qdrantUrl: process.env.QDRANT_URL || "",
  qdrantApiKey: process.env.QDRANT_API_KEY || "",
  collection: "ragent_docs",

  // ── MongoDB (chat history) ────────────────────────────────────
  // .env uses the key "Mongodb_url" — support both spellings.
  mongoUrl:
    process.env.MONGODB_URL ||
    process.env.Mongodb_url ||
    "mongodb://localhost:27017",
  mongoDb: "ragent",

  // ── RAG tuning ────────────────────────────────────────────────
  chunkSize: 1000, // characters per chunk
  chunkOverlap: 150, // character overlap between chunks
  vectorTopK: 8, // candidates fetched from Qdrant
  rerankTopK: 4, // chunks kept after Cohere rerank
  webMaxResults: 5, // Tavily results
  historyWindow: 12, // messages of chat history sent to LLM
} as const;
