import { Router } from "express";
import multer from "multer";
import { store } from "../memory/mongoStore";
import { ingestDocument, deleteDocumentVectors } from "../rag/ingest";

/**
 * Knowledge-base endpoints:
 *   POST   /api/documents/upload  → ingest a PDF/TXT/MD file
 *   GET    /api/documents         → list ingested documents
 *   DELETE /api/documents/:docId  → remove a document + its vectors
 */
export const documentsRouter = Router();

// Keep files in memory (max 15 MB) — nothing touches disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const ALLOWED = /\.(pdf|txt|md|markdown)$/i;

documentsRouter.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });
    if (!ALLOWED.test(file.originalname)) {
      return res.status(400).json({
        error: "Unsupported file type. Upload a PDF, TXT, or MD file.",
      });
    }

    console.log(`[documents] ingesting "${file.originalname}" (${file.size} bytes)`);
    const result = await ingestDocument(file.buffer, file.originalname);
    await store.addDocument(result);

    res.status(201).json(result);
  } catch (err) {
    console.error("[documents] upload failed:", err);
    const message = err instanceof Error ? err.message : "Ingestion failed";
    res.status(500).json({ error: message });
  }
});

documentsRouter.get("/", async (_req, res) => {
  try {
    const documents = await store.listDocuments();
    res.json(documents);
  } catch (err) {
    console.error("[documents] list failed:", err);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

documentsRouter.delete("/:docId", async (req, res) => {
  try {
    const { docId } = req.params;
    await deleteDocumentVectors(docId); // remove vectors from Qdrant
    await store.deleteDocument(docId); // remove metadata from MongoDB
    res.json({ ok: true });
  } catch (err) {
    console.error("[documents] delete failed:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});