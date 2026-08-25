import { ChatGroq } from "@langchain/groq";
import {
  SystemMessage,
  HumanMessage,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { config } from "../config";
import { hasDocuments } from "../rag/qdrant";
import { retrieveFromDocuments, retrieveFromWeb } from "../rag/retriever";
import type { AgentStateType } from "./state";
import type { RouteDecision, SourceDoc } from "../types";

/**
 * LangGraph node implementations.
 *
 * Flow:  router → retrieve (Qdrant+rerank) → web_search (Tavily)
 *        → generate (Groq, streamed) → check (self-verification)
 */

// ── LLM instances ────────────────────────────────────────────────
const chatLlm = new ChatGroq({
  apiKey: config.groqApiKey,
  model: config.chatModel,
  temperature: 0.3,
  streaming: true,
});

const fastLlm = new ChatGroq({
  apiKey: config.groqApiKey,
  model: config.fastModel,
  temperature: 0,
});

// ── 1. Router ────────────────────────────────────────────────────
const ROUTER_PROMPT = `You are a query router for a RAG assistant.

The user has a personal knowledge base of uploaded documents AND live web access.

Classify the user's question into exactly ONE word:
- "vector"  → the question is about the content of the uploaded documents, or is a follow-up about them
- "web"     → the question needs current, recent, or general world knowledge NOT likely in the documents
- "hybrid"  → the question benefits from BOTH document content and fresh web information

Respond with ONE WORD only: vector, web, or hybrid.`;

export async function routerNode(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  // No documents ingested yet → must use the web
  const hasDocs = await hasDocuments();
  if (!hasDocs) {
    return { route: "web", needVector: false, needWeb: true };
  }

  try {
    const res = await fastLlm.invoke([
      new SystemMessage(ROUTER_PROMPT),
      new HumanMessage(state.question),
    ]);
    const text = String(res.content).toLowerCase();
    const match = text.match(/vector|hybrid|web/);
    const route: RouteDecision = (match?.[0] as RouteDecision) ?? "vector";

    return {
      route,
      needVector: route === "vector" || route === "hybrid",
      needWeb: route === "web" || route === "hybrid",
    };
  } catch {
    // Router failure → safe default: try documents first
    return { route: "vector", needVector: true, needWeb: false };
  }
}

// ── 2a. Vector retrieval (Qdrant + Cohere rerank) ────────────────
export async function retrieveNode(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const sources = await retrieveFromDocuments(state.question);
  // Nothing relevant found in docs → pull in the web leg as backup
  const updates: Partial<AgentStateType> = { sources };
  if (sources.length === 0 && !state.needWeb) {
    updates.needWeb = true;
  }
  return updates;
}

// ── 2b. Web retrieval (Tavily) ───────────────────────────────────
export async function webSearchNode(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const sources = await retrieveFromWeb(state.question);
  return { sources };
}

// ── 3. Generate (Groq, token-streamed to client) ─────────────────
function buildContext(sources: SourceDoc[]): string {
  if (sources.length === 0) return "(no sources retrieved)";
  return sources
    .map((s, i) => {
      const kind = s.sourceType === "web" ? "WEB" : "DOC";
      const url = s.url ? ` | ${s.url}` : "";
      return `[${i + 1}] (${kind}) ${s.title}${url}\n${s.snippet}`;
    })
    .join("\n\n");
}

const SYSTEM_TEMPLATE = `You are RAGent, a precise AI research assistant.

Answer the user's question using ONLY the numbered context sources below.
Cite sources inline like [1], [2] matching the source numbers.
If the sources are insufficient, say so honestly and explain what is missing.
Prefer DOC sources for questions about the user's uploaded files;
use WEB sources for current events or general knowledge.
Be concise, well-structured (markdown), and accurate.

=== CONTEXT SOURCES ===
{context}
=== END SOURCES ===`;

export async function generateNode(
  state: AgentStateType,
  cfg?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  const system = SYSTEM_TEMPLATE.replace("{context}", buildContext(state.sources));

  const messages = [
    new SystemMessage(system),
    ...state.history,
    new HumanMessage(state.question),
  ];

  let answer = "";
  const onToken = cfg?.configurable?.onToken as
    | ((token: string) => void)
    | undefined;

  const stream = await chatLlm.stream(messages);
  for await (const chunk of stream) {
    const token = typeof chunk.content === "string" ? chunk.content : "";
    if (token) {
      answer += token;
      onToken?.(token); // push token to the SSE client live
    }
  }

  return { answer };
}

// ── 4. Self-check (groundedness verification) ────────────────────
const CHECK_PROMPT = `You are a strict answer verifier.

Given a QUESTION, CONTEXT SOURCES, and an ANSWER, decide whether the answer is
grounded: every factual claim in the answer must be supported by the sources,
and the answer should genuinely address the question.

Respond with ONLY minified JSON, no markdown:
{"grounded": true|false, "reason": "<short reason>"}`;

export async function checkNode(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  // Empty answer → definitely not grounded; enable web fallback if unused
  if (!state.answer.trim()) {
    return state.needWeb ? { grounded: false } : { grounded: false, needWeb: true };
  }
  try {
    const res = await fastLlm.invoke([
      new SystemMessage(CHECK_PROMPT),
      new HumanMessage(
        `QUESTION:\n${state.question}\n\nSOURCES:\n${buildContext(state.sources)}\n\nANSWER:\n${state.answer}`,
      ),
    ]);
    const raw = String(res.content);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const grounded = Boolean(parsed.grounded);
      // Self-correction: if ungrounded and web hasn't been tried yet,
      // enable the web leg so the graph loops back through Tavily.
      if (!grounded && !state.needWeb) {
        return { grounded, needWeb: true };
      }
      return { grounded };
    }
    return { grounded: true }; // can't verify → don't block
  } catch {
    return { grounded: true }; // checker failure → don't block the answer
  }
}
