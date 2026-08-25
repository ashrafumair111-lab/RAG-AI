interface EmptyStateProps {
  onNew: () => void;
}

const SUGGESTIONS = [
  "Summarize what's in my knowledge base",
  "How does the agent route between sources?",
  "What are the key numbers you know about?",
];

export function EmptyState({ onNew }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-icon">🤖</div>
      <h1>RAGent</h1>
      <p>Hybrid RAG + agentic assistant, built with LangGraph &amp; TypeScript.</p>
      <button className="new-session big" onClick={onNew}>
        Start a new chat
      </button>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="suggestion"
            onClick={() => onNew()} // opens a session; first message sets the title
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}