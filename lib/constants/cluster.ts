/**
 * kind node names (see kind-config.yaml) — the single source for exercise
 * text, setup/teardown commands, and checkers that reference nodes.
 */
export const NODES = {
  controlPlane: "cka-trainer-control-plane",
  worker: "cka-trainer-worker",
  worker2: "cka-trainer-worker2",
} as const;
