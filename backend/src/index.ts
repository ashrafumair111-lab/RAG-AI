import express from "express";
import cors from "cors";
import { config } from "./config";
import { store } from "./memory/mongoStore";
import { chatRouter } from "./routes/chat";
import { documentsRouter } from "./routes/documents";
import { sessionsRouter } from "./routes/sessions";

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "1mb" }));

// ── API routes ───────────────────────────────────────────────
app.use("/api/chat", chatRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/sessions", sessionsRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    groq: config.groqApiKey ? "✅" : "❌",
    tavily: config.tavilyApiKey ? "✅" : "❌",
    cohere: config.cohereApiKey ? "✅" : "❌",
    qdrant: config.qdrantUrl ? "✅" : "❌",
    mongodb: config.mongoUrl ? "✅" : "❌",
  });
});

// ── Startup ──────────────────────────────────────────────────
const start = async (): Promise<void> => {
  await store.connect();

  const server = app.listen(config.port, () => {
    console.log(`[server] RAGent backend running at http://localhost:${config.port}`);
    console.log("[server] API routes: /api/chat, /api/documents, /api/sessions");
  });

  // Handle listen-time errors (e.g. port already in use) instead of
  // crashing with an unhandled "error" event.
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[server] Port ${config.port} is already in use — another backend instance ` +
          "is probably running. Stop it (or set PORT) and try again.",
      );
    } else {
      console.error("[server] listen error:", err);
    }
    process.exit(1);
  });
};

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});