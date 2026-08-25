import { Router } from "express";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { store } from "../memory/mongoStore";
import { agentGraph } from "../agents/graph";
import type { SourceDoc } from "../types";

/**
 * Chat endpoint — Server-Sent Events (SSE) stream.
 *
 * Client sends:  POST /api/chat  { sessionId?, message }
 * Server emits framed events:
 *   event: status   { phase }            — agent phase change
 *   event: sources  SourceDoc[]        — when retrieval finishes
 *   event: token    string              — one LLM token at a time
 *   event: done     { answer, sources, grounded, sessionId }
 *   event: error    { message }
 */
export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const { sessionId, message } = req.body as {
    sessionId?: string;
    message?: string;
  };

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  // Open SSE connection
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let sid = sessionId;

  try {
    // ── Session + history ──────────────────────────────────────
    if (!sid) {
      const s = await store.createSession(message);
      sid = s.id;
    }
    // Rename "New chat" on first user message
    const sessions = await store.listSessions(1000);
    const session = sessions.find((s) => s.id === sid);
    if (session && session.title === "New chat") {
      await store.renameSessionIfDefault(sid, message);
    }

    await store.addMessage({ sessionId: sid, role: "user", content: message });

    const history = await store.getMessages(sid);
    const langHistory = history.map((m) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    );

    // ── Run the LangGraph agent with streaming ─────────────────
    const phaseMap: Record<string, string> = {
      router: "routing",
      retrieve: "retrieving",
      web_search: "web_search",
      generate: "generating",
      check: "checking",
    };

    let answer = "";
    let sources: SourceDoc[] = [];
    let grounded = true;

    // LangGraph 0.2.x: graph.stream() returns a Promise of an async stream.
    const stream = await agentGraph.stream(
      {
        question: message,
        history: langHistory,
        needVector: false, // reset per-run so router decides
        needWeb: false,
      },
      {
        configurable: {
          onToken: (token: string) => send("token", token),
        },
      },
    );

    for await (const chunk of stream) {
      for (const [nodeName, partial] of Object.entries(chunk)) {
        const phase = phaseMap[nodeName];
        if (phase) send("status", { phase });

        if (!partial) continue;
        const p = partial as Record<string, unknown>;
        if (p.sources) {
          sources = p.sources as SourceDoc[];
          send("sources", sources);
        }
        if (typeof p.answer === "string") answer = p.answer;
        if (typeof p.grounded === "boolean") grounded = p.grounded;
      }
    }

    send("done", { answer, sources, grounded, sessionId: sid });

    await store.addMessage({
      sessionId: sid,
      role: "assistant",
      content: answer,
      sources,
      grounded,
    });
    res.end();
  } catch (err) {
    console.error("[chat] error:", err);
    const message =
      err instanceof Error ? err.message : "Agent error";
    send("error", { message });
    res.end();
  }
});