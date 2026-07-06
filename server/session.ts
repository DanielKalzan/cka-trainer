import type { WebSocket } from "ws";
import { spawnShell } from "./pty";

interface ControlMessage {
  type: "resize";
  cols: number;
  rows: number;
}
// Control channel is text/JSON; terminal bytes are binary frames. More message
// types (check, reset, exercise session binding) arrive with the grading step.

const PING_INTERVAL_MS = 30_000;

export function attachSession(ws: WebSocket): void {
  const shell = spawnShell(80, 24);

  const onData = shell.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(Buffer.from(data));
  });
  const onExit = shell.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) ws.close(1000, `shell exited (${exitCode})`);
  });

  ws.on("message", (raw, isBinary) => {
    if (isBinary) {
      shell.write(raw.toString());
      return;
    }
    let msg: ControlMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "resize" && Number.isInteger(msg.cols) && Number.isInteger(msg.rows)) {
      shell.resize(Math.max(2, msg.cols), Math.max(2, msg.rows));
    }
  });

  const ping = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping();
  }, PING_INTERVAL_MS);

  ws.on("close", () => {
    clearInterval(ping);
    onData.dispose();
    onExit.dispose();
    shell.kill();
  });
}
