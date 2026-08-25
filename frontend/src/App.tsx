import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentPhase,
  IngestedDocument,
  Session,
  SourceDoc,
} from "./types";
import { documentsApi, healthApi, sessionsApi, streamChat } from "./api/client";
import { Sidebar } from "./components/Sidebar";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { EmptyState } from "./components/EmptyState";

/** A chat message rendered in the thread (either persisted or live). */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceDoc[];
  grounded?: boolean;
  createdAt?: string;
  phase?: AgentPhase | null;
  streaming?: boolean;
  error?: string;
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  // ── Health probe ---------------------------------------------------
  useEffect(() => {
    healthApi
      .get()
      .then((h) =>
        setHealth({
          groq: h.groq === "✅",
          tavily: h.tavily === "✅",
          cohere: h.cohere === "✅",
          qdrant: h.qdrant === "✅",
          mongodb: h.mongodb === "✅",
        }),
      )
      .catch(() => setHealth(null));
  }, []);

  // ── Load sessions + documents --------------------------------------
  const refreshSessions = useCallback(() => {
    sessionsApi
      .list()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  const refreshDocuments = useCallback(() => {
    documentsApi
      .list()
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  useEffect(() => {
    refreshSessions();
    refreshDocuments();
  }, [refreshSessions, refreshDocuments]);

  // ── Selecting a session --------------------------------------------
  const selectSession = useCallback(async (id: string | null) => {
    abortRef.current?.abort();
    setActiveId(id);
    setError(null);
    if (!id) {
      setMessages([]);
      return;
    }
    try {
      const msgs = await sessionsApi.messages(id);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  }, []);
// ── New / delete sessions ------------------------------------------
  const newSession = useCallback(async () => {
    try {
      const created = await sessionsApi.create();
      await selectSession(created.id);
      refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a session");
    }
  }, [refreshSessions, selectSession]);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await sessionsApi.remove(id);
      } catch {
        /* ignore */
      }
      refreshSessions();
      if (activeIdRef.current === id) setActiveId(null);
    },
    [refreshSessions],
  );

  // ── Sending a chat -------------------------------------------------
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;

      setError(null);
      abortRef.current?.abort();

      const userCreated = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed, createdAt: userCreated },
      ]);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streaming: true, sources: [] },
      ]);
      setThinking(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let sid = activeId ?? "";

      const patch = (fn: (m: ChatMessage) => ChatMessage): void => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = fn(last);
          }
          return copy;
        });
      };

      try {
        const result = await streamChat(
          { sessionId: sid || undefined, message: trimmed },
          {
            onToken: (token) =>
              patch((m) => ({
                ...m,
                content: (m.content ?? "") + token,
                phase: "generating",
              })),
            onStatus: (phase) =>
              patch((m) => ({ ...m, phase: phase as AgentPhase })),
            onSources: (sources) =>
              patch((m) => ({ ...m, sources })),
          },
          controller.signal,
        );

        sid = result.sessionId;
        setActiveId(result.sessionId);
        if (!activeId) refreshSessions();

        patch((m) => ({
          ...m,
          content: result.answer || m.content,
          sources: result.sources,
          grounded: result.grounded,
          streaming: false,
          phase: null,
        }));
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          patch((m) => ({ ...m, streaming: false, phase: null }));
        } else {
          patch((m) => ({
            ...m,
            streaming: false,
            phase: null,
            error: err instanceof Error ? err.message : "Agent error",
          }));
        }
      } finally {
        setThinking(false);
        abortRef.current = null;
        refreshSessions();
        if (sid) {
          sessionsApi
            .messages(sid)
            .then(setMessages)
            .catch(() => setMessages([]));
        }
      }
    },
    [activeId, refreshSessions, thinking],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const onUpload = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          await documentsApi.upload(file);
        } catch (err) {
          setError(
            `${file.name}: ${err instanceof Error ? err.message : "upload failed"}`,
          );
        }
      }
      refreshDocuments();
    },
    [refreshDocuments],
  );

  const onDeleteDocument = useCallback(
    async (docId: string) => {
      await documentsApi.remove(docId);
      refreshDocuments();
    },
    [refreshDocuments],
  );

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={selectSession}
        onNew={newSession}
        onDelete={deleteSession}
        documents={documents}
        onUpload={onUpload}
        onDeleteDocument={onDeleteDocument}
        health={health}
      />
      <main className="main">
        {activeId ? (
          <>
            <MessageList messages={messages} />
            <Composer
              onSend={sendMessage}
              onStop={stop}
              thinking={thinking}
              error={error}
            />
          </>
        ) : (
          <EmptyState onNew={newSession} />
        )}
      </main>
    </div>
  );
}