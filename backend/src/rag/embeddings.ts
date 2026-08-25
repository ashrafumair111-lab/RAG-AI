import { CohereClient } from "cohere-ai";
import { config } from "../config";

/**
 * Cohere embedding service.
 * embed-english-v3.0 requires an `inputType`:
 *   - "search_document" when embedding chunks at ingest time
 *   - "search_query"    when embedding the user's question
 */
const cohere = new CohereClient({ token: config.cohereApiKey });

/** Cohere allows max 96 texts per embed call. */
const BATCH_SIZE = 96;

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await cohere.embed({
      texts: batch,
      model: config.embedModel,
      inputType: "search_document",
      embeddingTypes: ["float"],
    });
    // embeddings is either a bare list (no embeddingTypes) or an object
    // keyed by type when embeddingTypes is supplied — narrow the union.
    const embeddings = Array.isArray(res.embeddings)
      ? res.embeddings
      : res.embeddings?.float ?? [];
    if (embeddings.length === 0)
      throw new Error("Cohere returned no embeddings");
    out.push(...embeddings);
  }
  return out;
}

export async function embedQuery(query: string): Promise<number[]> {
  const res = await cohere.embed({
    texts: [query],
    model: config.embedModel,
    inputType: "search_query",
    embeddingTypes: ["float"],
  });
  const embeddings = Array.isArray(res.embeddings)
    ? res.embeddings
    : res.embeddings?.float ?? [];
  const first = embeddings[0];
  if (!first) throw new Error("Cohere returned no embeddings");
  return first;
}
