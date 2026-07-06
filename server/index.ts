import * as fs from "fs";
import * as http from "http";
import { WebSocketServer } from "ws";
import { attachSession } from "./session";
import { sweepOrphanNamespaces } from "./exercise";
import { KUBECONFIG_PATH } from "./pty";

const PORT = Number(process.env.TERMINAL_BRIDGE_PORT ?? 3001);
const HOST = "127.0.0.1"; // localhost only — the bridge hands out a real shell
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("cka-trainer terminal bridge\n");
});

const wss = new WebSocketServer({ server, path: "/term" });

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    ws.close(1008, "origin not allowed");
    return;
  }
  const url = new URL(req.url ?? "/term", "http://localhost");
  const exerciseId = url.searchParams.get("exercise") ?? undefined;
  void attachSession(ws, exerciseId);
});

const SWEEP_INTERVAL_MS = 10 * 60_000;

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[bridge] port ${PORT} is already in use — another \`npm run dev\` (or docker compose) running? ` +
        `Stop it, or set TERMINAL_BRIDGE_PORT to a free port.`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`[bridge] listening on ws://${HOST}:${PORT}/term`);
  if (!fs.existsSync(KUBECONFIG_PATH)) {
    console.warn(
      `[bridge] warning: ${KUBECONFIG_PATH} not found — run \`npm run cluster:up\` or kubectl will have no cluster to talk to`,
    );
  }
  void sweepOrphanNamespaces();
  setInterval(() => void sweepOrphanNamespaces(), SWEEP_INTERVAL_MS);
});
