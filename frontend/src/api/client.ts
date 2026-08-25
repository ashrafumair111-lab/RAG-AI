/**
 * API client for the RAGent backend.
 *
 * All endpoints are proxied in dev via Vite; in production the SPA is served
 * from the same origin so relative paths work everywhere.
 */
import type {
  ChatResult,
  HealthStatus,
  IngestedDocument,
  Session,
  StoredMessage,
} from "../types";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore JSON parse errors */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Session endpoints. */
export const sessionsApi = {
  list: () => fetch("/api/sessions").then((r) => handle<Session[]>(r)),
  create: () =>
    fetch("/api/sessions", { method: "POST" }).then((r) => handle<Session>(r)),
  messages: (id: string) =>
    fetch(`/api/sessions/${id}/messages`).then((r) => handle<StoredMessage[]>(r)),
  remove: (id: string) =>
    fetch(`/api/sessions/${id}`, { method: "DELETE" }).then((r) => handle<{ ok: boolean }>(r)),
};

/** Document / knowledge-base endpoints --- */
export const documentsApi = {
  list: () => fetch("/api/documents").then((r) => handle<IngestedDocument[]>(r)),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch("/api/documents/upload", {
      method: "POST",
      body: fd,
    }).then((r) => handle<IngestedDocument>(r));
  },
  remove: (docId: string) =>
    fetch(`/api/documents/${docId}`, { method: "DELETE" }).then((r) => handle<{ ok: boolean }>(r)),
};

export const healthApi = {
  get: () => fetch("/health").then((r) => handle<HealthStatus>(r)),
};

/**
 * Stream a chat turn over Server-Sent Events.
 *
 * The backend returns POST + `text/event-stream` with named events:
 *   status, sources, token, done, error.
 * We read the raw stream, parse each `event:` / `data:` block, and forward
 * each event to the provided callbacks. Resolves with the `done` payload.
 */
export async function streamChat(
  payload: { sessionId?: string; message: string },
  handlers: {
    onToken?: (token: string) => void;
    onStatus?: (phase: string) => void;
    onSources?: (sources: ChatResult["sources"]) => void;
  },
  signal?: AbortSignal,
): Promise<ChatResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Chat failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseBlock = (block: string): void => {
    let event = "message";
    let data = "";
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    switch (event) {
      case "token":
        handlers.onToken?.(String(parsed));
        break;
      case "status": {
        const p = parsed as { phase?: string };
        handlers.onStatus?.(p.phase ?? "");
        break;
      }
      case "sources":
        handlers.onSources?.(parsed as ChatResult["sources"]);
        break;
      case "done":
        settle(() => {
          doneResolve?.(parsed as ChatResult);
        });
        break;
      case "error": {
        const e = parsed as { message?: string };
        settle(() => doneReject?.(new Error(e.message || "Agent error")));
        break;
      }
      default:
        break;
    }
  };

  let doneResolve: ((r: ChatResult) => void) | undefined;
  let doneReject: ((e: Error) => void) | undefined;
  const done = new Promise<ChatResult>((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });

  let settled = false;
  const settle = (fn: () => void): void => {
    if (settled) return;
    settled = true;
    fn();
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    // Split on the SSE double-newline delimiter.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (block.trim()) parseBlock(block);
    }
  }

  // Flush any trailing partial block, then close the done promise if the
  // agent finished without an explicit "done" event.
  if (buffer.trim()) parseBlock(buffer);
  if (!settled) settle(() => doneReject?.(new Error("Stream closed before completion")));

  return done;
}