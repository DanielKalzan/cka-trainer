"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

const WS_URL =
  process.env.NEXT_PUBLIC_TERMINAL_WS_URL ?? "ws://127.0.0.1:3001/term";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * Real terminal: xterm.js wired over WebSocket to the terminal bridge, which
 * runs bash + kubectl against the local kind cluster. Binary frames carry PTY
 * bytes; text frames carry JSON control messages (resize, later check/reset).
 */
export default function LiveTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [sessionKey, setSessionKey] = useState(0);

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

      ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";

      const sendResize = () => {
        if (ws?.readyState === WebSocket.OPEN && term) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      };

      ws.onopen = () => {
        if (disposed) return;
        setStatus("connected");
        sendResize();
        term?.focus();
      };
      ws.onclose = () => {
        if (!disposed) setStatus("disconnected");
      };
      ws.onerror = () => {
        if (!disposed) setStatus("disconnected");
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") return; // control channel, nothing yet
        term?.write(new Uint8Array(ev.data as ArrayBuffer));
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
      term?.dispose();
    };
  }, [sessionKey]);

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
              : status === "connecting"
                ? "text-warning"
                : "text-danger"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="relative">
        <div ref={containerRef} className="h-96 px-2 py-2" />
        {status === "disconnected" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-term-bg/80">
            <p className="text-sm text-muted">
              Terminal disconnected. Is the bridge running? (<code>npm run dev</code>)
            </p>
            <button
              onClick={() => {
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
}
