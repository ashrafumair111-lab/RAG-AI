import { v4 as uuidv4 } from "uuid";
import pdfParse from "pdf-parse";
import { config } from "../config";
import { embedDocuments } from "./embeddings";
import { ensureCollection, qdrant } from "./qdrant";
import type { StoredDocument } from "../types";

/**
 * Ingestion pipeline:
 *   raw file bytes → text extraction → chunking
 *   → Cohere embeddings → upsert into Qdrant.
 */

// Build control characters safely (avoids escape-sequence mangling)
const LF = String.fromCharCode(10); // line feed
const CRLF = String.fromCharCode(13) + LF; // carriage return + line feed
const PARA = LF + LF; // paragraph break

/** Split text into overlapping character chunks on paragraph boundaries. */
export function chunkText(
  text: string,
  size = config.chunkSize,
  overlap = config.chunkOverlap,
): string[] {
  const clean = text
    .split(CRLF)
    .join(LF)
    .replace(new RegExp(LF + "{3,}", "g"), PARA)
    .trim();
  if (clean.length <= size) return clean.length > 0 ? [clean] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    // Try to break at a paragraph or sentence boundary near the end
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf(PARA),
        slice.lastIndexOf(". "),
      );
      if (breakAt > size * 0.6) end = start + breakAt + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter((c) => c.length > 20);
}

/** Extract raw text from an uploaded buffer based on file type. */
export async function extractText(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    return result.text;
  }
  // .txt / .md / anything textual
  return buffer.toString("utf-8");
}

export interface IngestResult extends Omit<StoredDocument, "createdAt"> {}

/** Full ingestion of one uploaded document. */
export async function ingestDocument(
  buffer: Buffer,
  fileName: string,
): Promise<IngestResult> {
  await ensureCollection();

  const text = await extractText(buffer, fileName);
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error("Could not extract any readable text from this file.");
  }

  // Embed all chunks (batched internally)
  const vectors = await embedDocuments(chunks);

  const docId = uuidv4();
  const points = chunks.map((chunk, i) => ({
    id: uuidv4(),
    vector: vectors[i],
    payload: {
      text: chunk,
      docId,
      fileName,
      chunkIndex: i,
      createdAt: new Date().toISOString(),
    },
  }));

  // Upsert in batches of 100 points
  for (let i = 0; i < points.length; i += 100) {
    await qdrant.upsert(config.collection, {
      points: points.slice(i, i + 100),
      wait: true,
    });
  }

  return {
    docId,
    fileName,
    fileType: fileName.split(".").pop()?.toLowerCase() || "txt",
    chunks: chunks.length,
    chars: text.length,
  };
}

/** Delete every vector belonging to a document. */
export async function deleteDocumentVectors(docId: string): Promise<void> {
  try {
    await qdrant.delete(config.collection, {
      filter: {
        must: [{ key: "docId", match: { value: docId } }],
      },
    });
  } catch (err) {
    console.error("[ingest] vector delete failed:", err);
  }
}