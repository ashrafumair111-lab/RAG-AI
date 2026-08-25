import { tavily } from "@tavily/core";
import { createHash } from "crypto";
import { config } from "../config";
import { embedQuery } from "./embeddings";
import { searchVectors } from "./qdrant";
import { rerank } from "./reranker";
import type { SourceDoc } from "../types";

/**
 * Hybrid retrieval:
 *   - vector : Qdrant semantic search + Cohere rerank
 *   - web    : Tavily live web search
 */

const tvly = tavily({ apiKey: config.tavilyApiKey });

/** Retrieve from the user's uploaded documents (Qdrant + Cohere rerank). */
export async function retrieveFromDocuments(
  query: string,
): Promise<SourceDoc[]> {
  const vector = await embedQuery(query);
  const hits = await searchVectors(vector);
  if (hits.length === 0) return [];

  const reranked = await rerank(
    query,
    hits.map((h) => ({ id: h.id, text: h.text, title: h.fileName })),
  );

  return reranked.map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.text.slice(0, 400),
    sourceType: "document" as const,
    score: r.score,
  }));
}

/** Retrieve fresh information from the web via Tavily. */
export async function retrieveFromWeb(query: string): Promise<SourceDoc[]> {
  try {
    const res = await tvly.search(query, {
      maxResults: config.webMaxResults,
      includeAnswer: false,
    });
    return res.results.map((r) => ({
      id: "web-" + createHash("md5").update(r.url).digest("hex").slice(0, 12),
      title: r.title || r.url,
      url: r.url,
      snippet: (r.content || "").slice(0, 400),
      sourceType: "web" as const,
      score: r.score,
    }));
  } catch (err) {
    console.error("[tavily] search failed:", err);
    return [];
  }
}
