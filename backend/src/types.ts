/**
 * Shared types used across the RAGent backend.
 */

/** A single cited source (from Qdrant documents or Tavily web search). */
export interface SourceDoc {
  id: string; // unique id (qdrant point id or url hash)
  title: string; // file name or page title
  snippet: string; // text excerpt shown in UI
  url?: string; // only for web sources
  sourceType: "document" | "web";
  score?: number; // rerank/relevance score
}

/** Router decision made by the agent. */
export type RouteDecision = "vector" | "web" | "hybrid";

/** Chat message stored in MongoDB. */
export interface StoredMessage {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceDoc[];
  grounded?: boolean;
  createdAt: Date;
}

/** Session metadata stored in MongoDB. */
export interface StoredSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Document metadata stored in MongoDB. */
export interface StoredDocument {
  docId: string;
  fileName: string;
  fileType: string;
  chunks: number;
  chars: number;
  createdAt: Date;
}
