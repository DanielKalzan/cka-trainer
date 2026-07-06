"use client";

import LiveTerminal from "./LiveTerminal";

export default function SandboxTerminal() {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-muted">
        Real shell against the local kind cluster — kubectl, vim, the works. No
        grading, no stakes. Anything you break: <code>npm run cluster:reset</code>.
      </p>
      <LiveTerminal />
    </div>
  );
}
