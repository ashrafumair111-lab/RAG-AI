/** Shared client-side types mirroring the RAGent backend contracts. */

/** A single cited source (document chunk or web result). */
export interface SourceDoc {
  id: string;
  title: string;
  snippet: string;
  url?: string;
  sourceType: "document" | "web";
  score?: number;
}

/** Router decision made by the agent. */
export type RouteDecision = "vector" | "web" | "hybrid";

/** A chat message the user has sent. */
export interface UserMessage {
  role: "user";
  content: string;
}

/** A chat message from the assistant. */
export interface AssistantMessage {
  role: "assistant";
  content: string;
  sources?: SourceDoc[];
  grounded?: boolean;
}

/** Union of both roles for the UI message list. */
export type ChatMessage = UserMessage | AssistantMessage;

/** Session metadata returned by the backend. */
export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** Message with timestamps as returned by GET /api/sessions/:id/messages. */
export interface StoredMessage {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceDoc[];
  grounded?: boolean;
  createdAt: string;
}

/** Document metadata returned by the backend. */
export interface IngestedDocument {
  docId: string;
  fileName: string;
  fileType: string;
  chunks: number;
  chars: number;
  createdAt: string;
}

/** Agent phase reported over the SSE stream. */
export type AgentPhase =
  | "routing"
  | "retrieving"
  | "web_search"
  | "generating"
  | "checking";

/** The final payload of the SSE "done" event. */
export interface ChatResult {
  answer: string;
  sources: SourceDoc[];
  grounded: boolean;
  sessionId: string;
}

/** Floyd-style status payload from the health endpoint. */
export interface HealthStatus {
  status: string;
  groq: string;
  tavily: string;
  cohere: string;
  qdrant: string;
  mongodb: string;
}