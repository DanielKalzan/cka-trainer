"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { RotateCcw } from "lucide-react";
import type { CheckResult } from "@/lib/types/content";
import type { ServerControlMessage } from "@/lib/types/terminal-protocol";
import "@xterm/xterm/css/xterm.css";

const WS_URL =
  process.env.NEXT_PUBLIC_TERMINAL_WS_URL ?? "ws://127.0.0.1:3001/term";

type ConnectionStatus = "connecting" | "provisioning" | "connected" | "disconnected";

export interface LiveTerminalHandle {
  /** Ask the bridge to grade the exercise against this session's namespace.
   *  Resolves with a failed CheckResult (never rejects) if disconnected. */
  check: () => Promise<CheckResult>;
}

interface LiveTerminalProps {
  /** When set, the bridge provisions a dedicated namespace + setup for this exercise. */
  exerciseId?: string;
  /** Fired when the shell is live. namespace is null for sandbox sessions. */
  onReady?: (namespace: string | null) => void;
}

/**
 * Real terminal: xterm.js wired over WebSocket to the terminal bridge, which
 * runs bash + kubectl against the local kind cluster. Binary frames carry PTY
 * bytes; text frames carry JSON control messages (resize/check/ready/result).
 * Remount (change key) to get a fresh session — for exercises that means a
 * brand-new namespace, which is exactly what "reset" should do.
 */
const DISCONNECTED_RESULT: CheckResult = {
  passed: false,
  feedback: "Terminal isn't connected — reconnect and try again.",
};

const LiveTerminal = forwardRef<LiveTerminalHandle, LiveTerminalProps>(
  function LiveTerminal({ exerciseId, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    // FIFO of in-flight check requests; the bridge answers them in order.
    const pendingChecksRef = useRef<Array<(r: CheckResult) => void>>([]);
    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sessionKey, setSessionKey] = useState(0);

    // Keep latest callbacks without retriggering the connection effect.
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    useImperativeHandle(ref, () => ({
      check: () => {
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) {
          return Promise.resolve(DISCONNECTED_RESULT);
        }
        return new Promise<CheckResult>((resolve) => {
          pendingChecksRef.current.push(resolve);
          ws.send(JSON.stringify({ type: "check" }));
        });
      },
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      let disposed = false;
      let ws: WebSocket | null = null;
      let term: import("@xterm/xterm").Terminal | null = null;
      let resizeObserver: ResizeObserver | null = null;

      (async () => {
        // Dynamic import keeps xterm entirely out of the server render pass.
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
        ]);
        if (disposed) return;

        term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          // Resolve the Tailwind font-mono CSS variable — xterm can't use var() itself.
          fontFamily: getComputedStyle(el).fontFamily,
          theme: {
            background: "#0a0d11",
            foreground: "#e6edf3",
            cursor: "#3fdc97",
            selectionBackground: "#232c37",
            green: "#3fdc97",
            brightGreen: "#7ee2b8",
            red: "#f87171",
            yellow: "#fbbf24",
            blue: "#4f8ff7",
          },
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(el);
        fit.fit();

        const url = exerciseId
          ? `${WS_URL}?exercise=${encodeURIComponent(exerciseId)}`
          : WS_URL;
        ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        const sendResize = () => {
          if (ws?.readyState === WebSocket.OPEN && term) {
            ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        };

        ws.onopen = () => {
          if (disposed) return;
          // Exercise sessions provision a namespace before the shell exists.
          setStatus(exerciseId ? "provisioning" : "connected");
          sendResize();
        };
        const flushPending = () => {
          const pending = pendingChecksRef.current.splice(0);
          pending.forEach((resolve) =>
            resolve({
              passed: false,
              feedback: "Terminal disconnected before grading finished.",
            }),
          );
        };
        ws.onclose = () => {
          flushPending();
          if (!disposed) setStatus("disconnected");
        };
        ws.onerror = () => {
          flushPending();
          if (!disposed) setStatus("disconnected");
        };
        ws.onmessage = (ev) => {
          if (typeof ev.data !== "string") {
            term?.write(new Uint8Array(ev.data as ArrayBuffer));
            return;
          }
          let msg: ServerControlMessage;
          try {
            msg = JSON.parse(ev.data);
          } catch {
            return;
          }
          if (msg.type === "ready") {
            setStatus("connected");
            sendResize();
            term?.focus();
            onReadyRef.current?.(msg.namespace);
          } else if (msg.type === "check-result") {
            pendingChecksRef.current.shift()?.(msg.result);
          } else if (msg.type === "error") {
            setErrorMessage(msg.message);
          }
        };

        term.onData((data) => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(new TextEncoder().encode(data));
          }
        });
        term.onResize(sendResize);

        resizeObserver = new ResizeObserver(() => fit.fit());
        resizeObserver.observe(el);
      })();

      return () => {
        disposed = true;
        resizeObserver?.disconnect();
        ws?.close();
        wsRef.current = null;
        term?.dispose();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionKey, exerciseId]);

    return (
      <div className="overflow-hidden rounded-xl border border-edge bg-term-bg font-mono text-[13px] leading-relaxed">
        <div className="flex items-center gap-1.5 border-b border-edge/60 px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 text-xs text-faint">cluster: kind-cka-trainer</span>
          <span
            className={`ml-auto text-xs ${
              status === "connected"
                ? "text-term-green"
                : status === "disconnected"
                  ? "text-danger"
                  : "text-warning"
            }`}
          >
            {status === "provisioning" ? "provisioning namespace…" : status}
          </span>
        </div>

        <div className="relative">
          <div ref={containerRef} className="h-96 px-2 py-2" />
          {status === "disconnected" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-term-bg/80">
              <p className="px-6 text-center text-sm text-muted">
                {errorMessage ??
                  "Terminal disconnected. Is the bridge running? (npm run dev)"}
              </p>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setStatus("connecting");
                  setSessionKey((k) => k + 1);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                reconnect
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);

export default LiveTerminal;
