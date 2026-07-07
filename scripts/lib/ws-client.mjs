// Shared WebSocket test client for the terminal-bridge harnesses
// (scripts/dev/e2e-live-exercises.mjs, scripts/dev/e2e-exam.mjs,
// scripts/ci/smoke-test.mjs). These had three near-identical copies of the same
// connect/check/poll helpers that had already started to drift — keep one.
import WebSocket from "ws";

export const WS_URL = process.env.TERMINAL_WS_URL ?? "ws://127.0.0.1:3001/term";
export const ORIGIN = "http://localhost:3000";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Open a bridge session. Resolves once the bridge sends `ready`, with the
 *  provisioned namespace (null for a sandbox session when exerciseId is omitted). */
export function connect(exerciseId, { readyTimeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const label = exerciseId ?? "sandbox";
    const url = exerciseId ? `${WS_URL}?exercise=${exerciseId}` : WS_URL;
    const ws = new WebSocket(url, { origin: ORIGIN });
    const timer = setTimeout(() => reject(new Error(`${label}: ready timeout`)), readyTimeoutMs);
    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const msg = JSON.parse(data.toString());
      if (msg.type === "ready") {
        clearTimeout(timer);
        resolve({ ws, namespace: msg.namespace });
      } else if (msg.type === "error") {
        clearTimeout(timer);
        reject(new Error(`${label}: bridge error: ${msg.message}`));
      }
    });
    ws.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

/** Send one `check` and resolve with the bridge's next check-result. */
export function checkOnce(ws, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("check timeout")), timeoutMs);
    const onMsg = (data, isBinary) => {
      if (isBinary) return;
      const msg = JSON.parse(data.toString());
      if (msg.type === "check-result") {
        clearTimeout(timer);
        ws.off("message", onMsg);
        resolve(msg.result);
      }
    };
    ws.on("message", onMsg);
    ws.send(JSON.stringify({ type: "check" }));
  });
}

/** Poll `check` until it passes or the timeout elapses. */
export async function pollPass(ws, label, timeoutMs = 120000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await checkOnce(ws);
    if (last.passed) return last;
    await sleep(3000);
  }
  throw new Error(`${label}: never passed. Last feedback: ${last?.feedback}`);
}
