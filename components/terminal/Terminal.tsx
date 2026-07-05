"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ClusterState } from "@/lib/terminal-engine/cluster-state";
import {
  applyEditedYaml,
  applyYamlText,
  executeCommand,
  type EditorRequest,
} from "@/lib/terminal-engine/engine";

interface Line {
  kind: "cmd" | "out" | "err";
  text: string;
}

interface TerminalProps {
  /** Owned by the parent so checkers/reset can reach the same object. */
  clusterRef: MutableRefObject<ClusterState>;
  /** Called after any command that may have mutated state. */
  onCommand?: () => void;
  welcome?: string;
}

const PROMPT = "student@controlplane:~$";

export default function Terminal({ clusterRef, onCommand, welcome }: TerminalProps) {
  const [lines, setLines] = useState<Line[]>(
    welcome ? [{ kind: "out", text: welcome }] : [],
  );
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyPos, setHistoryPos] = useState(-1);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [editorText, setEditorText] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, editor]);

  useEffect(() => {
    if (editor) editorRef.current?.focus();
  }, [editor]);

  function append(...next: Line[]) {
    setLines((prev) => [...prev, ...next.filter((l) => l.text !== "")]);
  }

  function runCommand(raw: string) {
    const cmd = raw.trim();
    setLines((prev) => [...prev, { kind: "cmd", text: `${PROMPT} ${raw}` }]);
    if (cmd === "") return;
    setHistory((h) => (h[h.length - 1] === cmd ? h : [...h, cmd]));
    setHistoryPos(-1);

    if (cmd === "clear") {
      setLines([]);
      return;
    }
    const result = executeCommand(clusterRef.current, cmd);
    if (result.editor) {
      setEditor(result.editor);
      setEditorText(result.editor.initialYaml);
    }
    if (result.output !== "") {
      append({ kind: result.exitCode === 0 ? "out" : "err", text: result.output });
    }
    onCommand?.();
  }

  function saveEditor() {
    if (!editor) return;
    const result =
      editor.mode === "edit" && editor.target
        ? applyEditedYaml(clusterRef.current, editor.target, editorText)
        : applyYamlText(clusterRef.current, editorText);
    append({ kind: result.exitCode === 0 ? "out" : "err", text: result.output });
    setEditor(null);
    setEditorText("");
    onCommand?.();
    inputRef.current?.focus();
  }

  function cancelEditor() {
    append({ kind: "out", text: editor?.mode === "edit" ? "Edit cancelled, no changes made." : "apply cancelled." });
    setEditor(null);
    setEditorText("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      runCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const pos = historyPos === -1 ? history.length - 1 : Math.max(0, historyPos - 1);
      setHistoryPos(pos);
      setInput(history[pos]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyPos === -1) return;
      const pos = historyPos + 1;
      if (pos >= history.length) {
        setHistoryPos(-1);
        setInput("");
      } else {
        setHistoryPos(pos);
        setInput(history[pos]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-term-bg font-mono text-[13px] leading-relaxed">
      <div className="flex items-center gap-1.5 border-b border-edge/60 px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-3 text-xs text-faint">cluster: kubernetes-admin@kubernetes</span>
      </div>

      <div
        ref={scrollRef}
        className="h-96 cursor-text overflow-y-auto px-4 py-3"
        onClick={() => {
          if (window.getSelection()?.toString() === "") inputRef.current?.focus();
        }}
      >
        {lines.map((line, i) => (
          <pre
            key={i}
            className={`whitespace-pre-wrap break-words ${
              line.kind === "cmd"
                ? "text-term-prompt"
                : line.kind === "err"
                  ? "text-danger"
                  : "text-ink/85"
            }`}
          >
            {line.text}
          </pre>
        ))}

        {!editor ? (
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-term-prompt">{PROMPT}</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full bg-transparent text-term-green caret-term-green outline-none"
              spellCheck={false}
              autoComplete="off"
              autoFocus
              aria-label="terminal input"
            />
          </div>
        ) : null}
      </div>

      {editor ? (
        <div className="border-t border-edge/60">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted">
            <span>
              {editor.mode === "edit"
                ? `editing ${editor.target?.kind.toLowerCase()}/${editor.target?.name}`
                : "paste YAML, then apply"}
            </span>
            <span className="flex gap-2">
              <button
                onClick={saveEditor}
                className="rounded bg-term-green/15 px-3 py-1 text-term-green transition-colors hover:bg-term-green/25"
              >
                {editor.mode === "edit" ? "save" : "apply"}
              </button>
              <button
                onClick={cancelEditor}
                className="rounded bg-raised px-3 py-1 text-muted transition-colors hover:text-ink"
              >
                cancel
              </button>
            </span>
          </div>
          <textarea
            ref={editorRef}
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full resize-y bg-black/30 px-4 py-3 font-mono text-[13px] text-ink/90 outline-none"
            placeholder={"apiVersion: v1\nkind: Pod\nmetadata:\n  name: ..."}
          />
        </div>
      ) : null}
    </div>
  );
}
