import { useRef, useState } from "react";
import type { IngestedDocument, Session } from "../types";

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  documents: IngestedDocument[];
  onUpload: (files: File[]) => void;
  onDeleteDocument: (docId: string) => void;
  health: Record<string, boolean> | null;
}

const HEALTH_LABELS: Record<string, string> = {
  groq: "Groq LLM",
  tavily: "Tavily search",
  cohere: "Cohere",
  qdrant: "Qdrant",
  mongodb: "MongoDB",
};

export function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  documents,
  onUpload,
  onDeleteDocument,
  health,
}: SidebarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const acceptFiles = (files: FileList | null): void => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading(true);
    onUpload(list);
    setTimeout(() => setUploading(false), 400);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="logo">🤖</span>
        <span className="logo-title">RAGent</span>
      </div>
      <button className="new-session" onClick={onNew}>
        + New chat
      </button>

      <div className="sidebar-section">
        <h3 className="section-title">Sessions</h3>
        <ul className="session-list">
          {sessions.length === 0 && (
            <li className="session-empty">No sessions yet</li>
          )}
          {sessions.map((s) => (
            <li
              key={s.id}
              className={`session-item${s.id === activeId ? " active" : ""}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="session-title">{s.title || "Untitled"}</span>
              <button
                className="session-delete"
                title="Delete session"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section grow">
        <h2 className="section-title">Knowledge base</h2>

        <div
          className={`dropzone${dragging ? " dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            acceptFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Drop PDF/TXT/MD or click"}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown"
            multiple
            hidden
            onChange={(e) => {
              acceptFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <ul className="doc-list">
          {documents.length === 0 && (
            <li className="doc-empty">No documents ingested</li>
          )}
          {documents.map((d) => (
            <li key={d.docId} className="doc-item">
              <div className="doc-info">
                <span className="doc-name">{d.fileName}</span>
                <span className="doc-meta">
                  {d.chunks} chunks · {d.fileType.toUpperCase()}
                </span>
              </div>
              <button
                className="doc-delete"
                title="Remove document"
                onClick={() => onDeleteDocument(d.docId)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-foot">
        {health
          ? Object.entries(health).map(([key, ok]) => (
              <div key={key} className="health-row">
                <span className={`dot ${ok ? "ok" : "err"}`} />
                <span className="health-name">{HEALTH_LABELS[key] ?? key}</span>
              </div>
            ))
          : <div className="health-name">Backend unreachable</div>}
      </div>
    </aside>
  );
}