import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ts-pod-triage",
  domainId: "troubleshooting",
  title: "Pod triage: one loop for every broken pod",
  estMinutes: 12,
  body: `
30% of the exam is troubleshooting, and most of that is broken pods. Don't improvise — run the same loop every time:

\`\`\`bash
kubectl get pods -A                  # find the victim, read the STATUS column
kubectl describe pod <name> -n <ns>  # Events section = 90% of answers
kubectl logs <name> -n <ns>          # app-level errors
kubectl logs <name> -n <ns> --previous   # if it's restarting, the crash is in the PREVIOUS log
\`\`\`

## Decode the STATUS column

| STATUS | Meaning | Where to look |
|---|---|---|
| \`ImagePullBackOff\` / \`ErrImagePull\` | registry/image name wrong | \`describe\` events — read the exact image string for typos |
| \`CrashLoopBackOff\` | container starts then exits | \`logs --previous\` — the app tells you why it died |
| \`Pending\` | unschedulable | \`describe\` events — taints, resources, nodeSelector |
| \`ContainerCreating\` (stuck) | volume/configmap/secret missing | \`describe\` events — mount failures |
| \`OOMKilled\` (in restart reason) | memory limit too low | \`describe\` → Last State: Terminated, Reason: OOMKilled |
| \`Completed\` | not a bug — the container exited 0 | is it supposed to be a Job? |

## The fix depends on who owns the pod

Check the pod name. \`web-5d78f9c6b-x2v4q\` = Deployment-owned (name-hash-suffix). \`web\` = bare pod.

- **Deployment-owned:** fix the *Deployment* (\`kubectl set image\`, \`kubectl edit deploy\`), never the pod — the controller replaces pods with the old template anyway.
- **Bare pod:** most spec fields are immutable. Fix = delete and recreate (\`kubectl get pod X -o yaml > x.yaml\`, edit, \`kubectl replace --force -f x.yaml\` or delete + apply).

## Pending pods: the three usual suspects

\`describe\` events name the culprit exactly:

1. **Taints** — \`0/2 nodes are available: 1 node(s) had untolerated taint ...\` → remove the taint (\`kubectl taint node node01 key-\`) or add a toleration.
2. **Resources** — \`Insufficient cpu/memory\` → lower requests or scale other things down.
3. **Selectors** — \`didn't match Pod's node affinity/selector\` → fix the nodeSelector or label the node.

After fixing the cause, a Pending pod usually reschedules on its own; a pod owned by a ReplicaSet can also just be deleted — the controller makes a fresh one that schedules cleanly.
`,
  tips: [
    {
      type: "exam-tip",
      text: "kubectl logs --previous is the single most forgotten troubleshooting flag. CrashLoopBackOff? The current container hasn't logged anything yet — the answer is in the previous one.",
    },
    {
      type: "exam-tip",
      text: "Read the events BOTTOM of kubectl describe first. The exam plants the exact error message there — image typo, taint name, missing configmap.",
    },
    {
      type: "deep-dive",
      text: "kubectl get events --sort-by=.metadata.creationTimestamp -A gives a cluster-wide timeline — useful when you don't yet know which object is broken.",
    },
    {
      type: "deep-dive",
      text: "kubectl replace --force -f pod.yaml is delete+create in one step and preserves your edited spec — faster than delete then apply for bare-pod surgery.",
    },
  ],
};

export default lesson;
