import { CohereClient } from "cohere-ai";
import { config } from "../config";

/**
 * Cohere Rerank — re-scores retrieved chunks against the query
 * so the LLM only sees the most relevant context.
 */
const cohere = new CohereClient({ token: config.cohereApiKey });

export interface RerankItem {
  id: string;
  text: string;
  title: string;
}

export interface RerankedItem extends RerankItem {
  score: number;
}

export async function rerank(
  query: string,
  items: RerankItem[],
  topK = config.rerankTopK,
): Promise<RerankedItem[]> {
  if (items.length === 0) return [];
  try {
    const res = await cohere.rerank({
      model: config.rerankModel,
      query,
      documents: items.map((i) => i.text),
      topN: Math.min(topK, items.length),
    });
    return res.results.map((r) => ({
      ...items[r.index],
      score: r.relevanceScore,
    }));
  } catch (err) {
    console.error("[rerank] failed, falling back to original order:", err);
    // Graceful fallback: keep original order (already similarity-ranked)
    return items.slice(0, topK).map((i) => ({ ...i, score: 0 }));
  }
}
