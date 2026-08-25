import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  thinking: boolean;
  error: string | null;
}

export function Composer({ onSend, onStop, thinking, error }: ComposerProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  const submit = (): void => {
    const text = value.trim();
    if (!text || thinking) return;
    onSend(text);
    setValue("");
    taRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    submit();
  };

  return (
    <div className="composer-wrap">
      {error ? <div className="composer-error">{error}</div> : null}
      <form className="composer" onSubmit={onSubmit}>
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          placeholder="Ask anything… (Shift+Enter for newline)"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {thinking ? (
          <button type="button" className="send stop" onClick={onStop} title="Stop">
            ■
          </button>
        ) : (
          <button
            type="submit"
            className="send"
            disabled={!value.trim()}
            title="Send"
          >
            ➤
          </button>
        )}
      </form>
    </div>
  );
}