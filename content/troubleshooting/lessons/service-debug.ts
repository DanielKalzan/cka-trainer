import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ts-service-debug",
  domainId: "troubleshooting",
  title: "Service has no endpoints: the 3-check debug",
  estMinutes: 10,
  body: `
"App unreachable through the Service" tasks have exactly three usual causes. Check them in order — it takes under a minute.

## Check 1: does the Service select any pods?

\`\`\`bash
kubectl get endpoints web-svc          # ENDPOINTS column empty? selector problem.
kubectl get svc web-svc -o wide        # note the SELECTOR
kubectl get pods -l app=web --show-labels
\`\`\`

Empty endpoints = the Service's \`selector\` doesn't match any pod's **labels**. Typos (\`app: webb\`), wrong key (\`run:\` vs \`app:\`), or pods in a different namespace. Fix the selector (\`kubectl edit svc\`) or the pod labels — whichever the task says is authoritative.

## Check 2: does targetPort match the container?

Endpoints exist but connections die?

- \`port\` = where the Service listens.
- \`targetPort\` = where the **container** listens. Must equal \`containerPort\` (or a named port).

\`\`\`bash
kubectl describe svc web-svc            # TargetPort row
kubectl get pod <one> -o yaml | grep containerPort
\`\`\`

A Service with \`port: 80, targetPort: 80\` in front of a container listening on 8080 selects pods fine and still serves nothing.

## Check 3: are the selected pods actually Ready?

Endpoints only include **Ready** pods. A failing readinessProbe silently removes a pod from every Service:

\`\`\`bash
kubectl get pods -l app=web             # READY column 0/1?
kubectl describe pod <name>             # probe failure events
\`\`\`

## When those pass: DNS

Test resolution from inside the cluster:

\`\`\`bash
kubectl run tmp --image=busybox:1.36 --rm -it --restart=Never -- nslookup web-svc
\`\`\`

Service DNS is \`<svc>.<namespace>.svc.cluster.local\` — cross-namespace access needs at least \`web-svc.prod\`. If nothing resolves, check the CoreDNS pods in \`kube-system\`.

## NetworkPolicy: the invisible wall

Everything above healthy but traffic still blocked? Look for NetworkPolicies:

\`\`\`bash
kubectl get netpol -A
\`\`\`

Once ANY policy selects a pod, that pod denies all traffic not explicitly allowed. A policy allowing only \`app=web\` ingress to the DB silently drops your new client pod.
`,
  tips: [
    {
      type: "exam-tip",
      text: "kubectl get endpoints <svc> is the fastest service-debug command that exists. Empty endpoints → selector/labels. Present but broken → targetPort or probes.",
    },
    {
      type: "exam-tip",
      text: "kubectl run tmp --image=busybox:1.36 --rm -it --restart=Never -- <cmd> is your disposable network test pod. Memorize it as one unit.",
    },
    {
      type: "deep-dive",
      text: "Named targetPorts (targetPort: http) survive container port changes — the endpoint controller resolves the name per-pod. Rare on the exam but legal in any Service YAML.",
    },
    {
      type: "deep-dive",
      text: "Headless Services (clusterIP: None) return per-pod A records instead of a virtual IP — that's how StatefulSets get stable per-pod DNS names.",
    },
  ],
};

export default lesson;
