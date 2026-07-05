"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { ClusterState } from "@/lib/terminal-engine/cluster-state";
import { sandboxState } from "@/lib/terminal-engine/fixtures/sandbox";

import Terminal from "./Terminal";

export default function SandboxTerminal() {
  const clusterRef = useRef<ClusterState>(sandboxState());
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => {
            clusterRef.current = sandboxState();
            setSessionKey((k) => k + 1);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          reset cluster
        </button>
      </div>
      <Terminal
        key={sessionKey}
        clusterRef={clusterRef}
        welcome={
          "Sandbox cluster: 3 nodes, deployments web + api, one broken pod (find it).\nNo grading here — build muscle memory. Type 'help' for supported commands."
        }
      />
    </div>
  );
}
