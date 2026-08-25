import { Router } from "express";
import { store } from "../memory/mongoStore";

/**
 * Session management endpoints:
 *   POST   /api/sessions            → create a new chat session
 *   GET    /api/sessions            → list recent sessions
 *   GET    /api/sessions/:id/messages → full history of one session
 *   DELETE /api/sessions/:id        → delete session + its messages
 */
export const sessionsRouter = Router();

sessionsRouter.post("/", async (_req, res) => {
  try {
    const session = await store.createSession();
    res.status(201).json(session);
  } catch (err) {
    console.error("[sessions] create failed:", err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

sessionsRouter.get("/", async (_req, res) => {
  try {
    const sessions = await store.listSessions();
    res.json(sessions);
  } catch (err) {
    console.error("[sessions] list failed:", err);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

sessionsRouter.get("/:id/messages", async (req, res) => {
  try {
    const messages = await store.getAllMessages(req.params.id);
    res.json(messages);
  } catch (err) {
    console.error("[sessions] history failed:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

sessionsRouter.delete("/:id", async (req, res) => {
  try {
    await store.deleteSession(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[sessions] delete failed:", err);
    res.status(500).json({ error: "Failed to delete session" });
  }
});