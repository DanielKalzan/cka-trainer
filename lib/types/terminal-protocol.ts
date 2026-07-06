import type { CheckResult } from "./content";

/**
 * WebSocket control channel between LiveTerminal and the bridge.
 * Binary frames carry raw PTY bytes; text frames carry these JSON messages.
 */

export type ClientControlMessage =
  | { type: "resize"; cols: number; rows: number }
  | { type: "check" };

export type ServerControlMessage =
  /** Session PTY is live. namespace is null for sandbox (no exercise) sessions. */
  | { type: "ready"; namespace: string | null }
  | { type: "check-result"; result: CheckResult }
  | { type: "error"; message: string };
