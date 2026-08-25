import { useEffect, useRef } from "react";
import type { ChatMessage } from "../App";
import type { SourceDoc } from "../types";

const PHASE_LABEL: Record<string, string> = {
  routing: "Routing…",
  retrieving: "Searching your documents…",
  web_search: "Searching the web…",
  generating: "Answering…",
  checking: "Checking answer…",
};

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.map((m, i) => (
        <MessageRow key={i} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="message user">
        <div className="bubble">{message.content}</div>
      </div>
    );
  }

  const streaming = message.streaming;
  const text = message.content ?? "";
  const phase = message.phase;

  return (
    <div className="message assistant">
      <div className="bubble">
        {text ? <Content text={text} /> : null}
        {streaming && <span className="cursor">▍</span>}
        {!text && phase ? (
          <div className="phase">
            <span className="spinner" />
            {PHASE_LABEL[phase] ?? phase}
          </div>
        ) : null}
        {message.error ? <div className="error">{message.error}</div> : null}
      </div>
      <Sources sources={message.sources ?? []} />
    </div>
  );
}

function Content({ text }: { text: string }) {
  // Simple markdown-ish rendering: code blocks + inline code + line breaks.
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const code = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre key={i} className="code-block">
              <code>{code}</code>
            </pre>
          );
        }
        return <InlineText key={i} text={part} />;
      })}
    </>
  );
}

function InlineText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          <InlineLine line={line} />
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

function InlineLine({ line }: { line: string }) {
  // Render `inline code` spans.
  const parts = line.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={i} className="inline-code">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Sources({ sources }: { sources?: SourceDoc[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="sources">
      <div className="sources-label">Sources</div>
      <ul>
        {sources.map((s) => (
          <li key={s.id}>
            {s.sourceType === "web" && s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              <span>{s.title}</span>
            )}
            {typeof s.score === "number" ? (
              <span className="score">{s.score.toFixed(2)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}