import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ws-rollouts",
  domainId: "workloads-scheduling",
  title: "Deployments: rollouts, rollbacks, and the commands that grade",
  estMinutes: 10,
  body: `
## The five commands you'll actually type

\`\`\`bash
kubectl create deployment web --image=nginx:1.27 --replicas=3
kubectl set image deployment/web nginx=nginx:1.28        # triggers a rolling update
kubectl rollout status deployment/web                    # wait for it / prove it worked
kubectl rollout history deployment/web                   # revisions
kubectl rollout undo deployment/web [--to-revision=2]    # roll back
\`\`\`

\`set image\` takes \`CONTAINER=IMAGE\` — the container name, not the deployment name. \`kubectl describe deploy web\` shows container names when unsure; \`*=image\` hits all containers.

## How a rolling update actually moves

The Deployment creates a **new ReplicaSet** per template change and shifts replicas over. Old ReplicaSets stay at 0 — they ARE the rollback history.

Strategy knobs (under \`spec.strategy.rollingUpdate\`):

- \`maxSurge\` — how many extra pods may exist during the roll (default 25%).
- \`maxUnavailable\` — how many may be missing (default 25%).
- \`maxSurge: 1, maxUnavailable: 0\` = the classic "no capacity loss" requirement in exam tasks.
- \`strategy.type: Recreate\` = kill all, then start new — for apps that can't run two versions at once.

## Scale is not a rollout

\`\`\`bash
kubectl scale deployment web --replicas=5
\`\`\`

Scaling changes replica count on the SAME ReplicaSet — no new revision, nothing in rollout history. Tasks saying "update the app without downtime" mean image/template changes, not scale.

## Rollback correctness

\`rollout undo\` returns to the previous template as a **new revision** (rolling back rev 3 → rev 2's template arrives as rev 4). \`--to-revision=N\` targets an exact one; \`rollout history --revision=N\` shows what N contained before you leap.
`,
  tips: [
    {
      type: "exam-tip",
      text: "Finish every deployment task with kubectl rollout status deployment/<name> — it blocks until done and its 'successfully rolled out' line is your proof the task is complete.",
    },
    {
      type: "exam-tip",
      text: "set image needs the CONTAINER name: kubectl set image deploy/web nginx=nginx:1.28. Wrong container name = 'unable to find container' — check with describe.",
    },
    {
      type: "deep-dive",
      text: "revisionHistoryLimit (default 10) caps retained old ReplicaSets; beyond it, those revisions become unrollbackable. Why prod configs often raise it.",
    },
    {
      type: "deep-dive",
      text: "kubectl rollout restart deployment/web bumps a pod-template annotation to force fresh pods with an unchanged spec — the standard trick to make pods re-read a changed ConfigMap.",
    },
  ],
};

export default lesson;
