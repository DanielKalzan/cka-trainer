import * as fs from "fs";
import * as http from "http";
import { WebSocketServer } from "ws";
import { attachSession } from "./session";
import { sweepOrphanNamespaces } from "./exercise";
import { KUBECONFIG_PATH } from "./pty";

const PORT = Number(process.env.TERMINAL_BRIDGE_PORT ?? 3001);
// Loopback only. The bridge hands out a shell into the cluster and has no auth
// layer, so it must never be reachable from the LAN or the public internet —
// network isolation is the guard. Under docker-compose the app uses the host
// network namespace (see docker-compose.yml), so 127.0.0.1 here == the host's
// loopback: reachable from the browser on this machine, nothing else.
const HOST = "127.0.0.1";

/** The only origins the frontend is ever served from on this machine. Any WS
 *  connection whose Origin isn't one of these — including a missing Origin,
 *  which is what non-browser clients send — is rejected. */
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
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
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
  console.log(`[bridge] listening on ${HOST}:${PORT} — allowed origins: ${[...ALLOWED_ORIGINS].join(", ")}`);
  if (!fs.existsSync(KUBECONFIG_PATH)) {
    console.warn(
      `[bridge] warning: ${KUBECONFIG_PATH} not found — run \`npm run cluster:up\` or kubectl will have no cluster to talk to`,
    );
  }
  void sweepOrphanNamespaces();
  setInterval(() => void sweepOrphanNamespaces(), SWEEP_INTERVAL_MS);
});
