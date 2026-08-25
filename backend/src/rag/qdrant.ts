import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config";

/**
 * Qdrant Cloud client + collection management.
 * Collection: config.collection, vectors: Cohere embed-v3 (1024 dims, cosine).
 */
export const qdrant = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey,
});

/** Create the collection if it does not exist yet. Safe to call repeatedly. */
export async function ensureCollection(): Promise<void> {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === config.collection,
  );
  if (!exists) {
    await qdrant.createCollection(config.collection, {
      vectors: {
        size: config.embedDim,
        distance: "Cosine",
      },
    });
    console.log(`[qdrant] created collection "${config.collection}"`);
  }
}

/** True when the collection has at least one point. */
export async function hasDocuments(): Promise<boolean> {
  try {
    const info = await qdrant.getCollection(config.collection);
    return (info.points_count ?? 0) > 0;
  } catch {
    return false;
  }
}

export interface QdrantHit {
  id: string;
  text: string;
  fileName: string;
  docId: string;
  score: number;
}

/** Semantic search over ingested document chunks. */
export async function searchVectors(
  vector: number[],
  topK = config.vectorTopK,
): Promise<QdrantHit[]> {
  try {
    // Modern @qdrant/js-client-rest uses the unified /points/query endpoint.
    const res = await qdrant.query(config.collection, {
      query: vector,
      limit: topK,
      with_payload: true,
    });
    const results = (res.points ?? [])
      .slice()
      .sort((a, b) => b.score - a.score);
    return results.map((r) => {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id),
        text: String(p.text ?? ""),
        fileName: String(p.fileName ?? "document"),
        docId: String(p.docId ?? ""),
        score: r.score,
      };
    });
  } catch (err) {
    console.error("[qdrant] search failed:", err);
    return [];
  }
}
