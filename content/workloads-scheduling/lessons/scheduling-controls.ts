import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ws-scheduling-controls",
  domainId: "workloads-scheduling",
  title: "Steering the scheduler: selectors, affinity, taints",
  estMinutes: 12,
  body: `
Three mechanisms, one mental model: **selectors/affinity attract pods to nodes; taints repel pods from nodes.** Exam tasks name which one they want — recognize the phrasing.

## nodeSelector — "run on nodes labeled X"

\`\`\`bash
kubectl label node node01 disk=ssd
\`\`\`
\`\`\`yaml
spec:
  nodeSelector:
    disk: ssd
\`\`\`

Exact label match, nothing else. If no node matches, the pod stays Pending — a favorite troubleshooting crossover.

## nodeAffinity — nodeSelector with vocabulary

\`\`\`yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: disk
            operator: In           # In, NotIn, Exists, DoesNotExist, Gt, Lt
            values: ["ssd"]
\`\`\`

- \`required...\` = hard rule (pod Pending if unmet).
- \`preferred...\` = soft rule with a \`weight\` — schedule anyway if impossible.
- \`IgnoredDuringExecution\` = already-running pods aren't evicted when labels change.

## Taints & tolerations — "keep everyone off this node"

\`\`\`bash
kubectl taint node node01 dedicated=gpu:NoSchedule    # add
kubectl taint node node01 dedicated-                  # remove (trailing dash)
\`\`\`

Effects: \`NoSchedule\` (block new pods), \`PreferNoSchedule\` (soft), \`NoExecute\` (block AND evict running ones).

A pod tolerates it with:

\`\`\`yaml
tolerations:
- key: dedicated
  operator: Equal
  value: gpu
  effect: NoSchedule
\`\`\`

Toleration ≠ placement: it only *permits* the node. Dedicated-node tasks ("only these pods on node X, and only on it") need **taint + toleration + nodeSelector/affinity together**.

## Manual & static placement

- \`spec.nodeName: node01\` — bypasses the scheduler entirely. How you place a pod when the scheduler itself is broken.
- **Static pods** — manifest in \`/etc/kubernetes/manifests/\` on a node; kubelet runs it directly. Control-plane components work this way.

## DaemonSets

One pod per (matching) node, no replicas field. Scheduling tasks intersect: a DaemonSet that must also run on control-plane nodes needs a toleration for \`node-role.kubernetes.io/control-plane\`.
`,
  tips: [
    {
      type: "exam-tip",
      text: "Remove a taint by repeating its key with a trailing dash: kubectl taint node node01 dedicated-. Same dash-suffix idiom removes labels: kubectl label node node01 disk-.",
    },
    {
      type: "exam-tip",
      text: "'Ensure ONLY these pods run on the node' = taint it. 'Ensure these pods run ONLY on that node' = nodeSelector/affinity. Tasks phrased with both directions need both mechanisms.",
    },
    {
      type: "deep-dive",
      text: "podAffinity/podAntiAffinity schedule relative to other PODS (via topologyKey, e.g. kubernetes.io/hostname). Anti-affinity on the app's own label = classic replicas-spread pattern; heavier than the newer topologySpreadConstraints.",
    },
    {
      type: "deep-dive",
      text: "NoExecute taints power node lifecycle: node.kubernetes.io/not-ready and /unreachable get added automatically, and every pod carries a default 300s toleration for them — that's why eviction takes 5 minutes after a node dies.",
    },
  ],
};

export default lesson;
