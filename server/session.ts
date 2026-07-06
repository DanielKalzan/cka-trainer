import type { WebSocket } from "ws";
import type { IPty } from "node-pty";
import type {
  ClientControlMessage,
  ServerControlMessage,
} from "@/lib/types/terminal-protocol";
import { spawnShell } from "./pty";
import {
  createExerciseSession,
  runCheck,
  teardownExerciseSession,
  type ExerciseSession,
} from "./exercise";

const PING_INTERVAL_MS = 30_000;

function send(ws: WebSocket, msg: ServerControlMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

/**
 * 1 WS connection = 1 PTY session (= 1 exercise namespace when exerciseId is
 * set). Namespace lifetime is bound to the connection: reset in the UI is
 * simply reconnect, teardown happens on close.
 */
export async function attachSession(ws: WebSocket, exerciseId?: string): Promise<void> {
  let shell: IPty | null = null;
  let session: ExerciseSession | null = null;
  let size = { cols: 80, rows: 24 };
  let closed = false;

  ws.on("message", (raw, isBinary) => {
    if (isBinary) {
      shell?.write(raw.toString());
      return;
    }
    let msg: ClientControlMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "resize" && Number.isInteger(msg.cols) && Number.isInteger(msg.rows)) {
      size = { cols: Math.max(2, msg.cols), rows: Math.max(2, msg.rows) };
      shell?.resize(size.cols, size.rows);
    } else if (msg.type === "check" && session) {
      void runCheck(session).then((result) => send(ws, { type: "check-result", result }));
    }
  });

  const ping = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping();
  }, PING_INTERVAL_MS);

  ws.on("close", () => {
    closed = true;
    clearInterval(ping);
    shell?.kill();
    if (session) void teardownExerciseSession(session);
  });

  if (exerciseId) {
    try {
      session = await createExerciseSession(exerciseId);
    } catch (err) {
      send(ws, { type: "error", message: (err as Error).message });
      ws.close(1011, "exercise setup failed");
      return;
    }
    if (closed) {
      // Client vanished during namespace provisioning.
      void teardownExerciseSession(session);
      return;
    }
  }

  shell = spawnShell(size.cols, size.rows, session?.kubeconfigPath);
  shell.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(Buffer.from(data));
  });
  shell.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) ws.close(1000, `shell exited (${exitCode})`);
  });
  send(ws, { type: "ready", namespace: session?.namespace ?? null });
}
