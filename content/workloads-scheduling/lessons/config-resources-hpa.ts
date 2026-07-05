import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ws-config-resources-hpa",
  domainId: "workloads-scheduling",
  title: "ConfigMaps, resources and autoscaling",
  estMinutes: 12,
  body: `
## ConfigMaps & Secrets: create imperatively, consume in YAML

\`\`\`bash
kubectl create configmap app-config --from-literal=DB_HOST=db --from-literal=LOG_LEVEL=info
kubectl create secret generic db-creds --from-literal=password='S3cret!'
\`\`\`

Three consumption patterns — know all three shapes:

\`\`\`yaml
containers:
- name: app
  envFrom:                          # 1. ALL keys as env vars
  - configMapRef: { name: app-config }
  env:                              # 2. one key, renamed
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef: { name: db-creds, key: password }
  volumeMounts:                     # 3. keys as files
  - name: cfg
    mountPath: /etc/app
volumes:
- name: cfg
  configMap: { name: app-config }
\`\`\`

Env vars are read **once at container start** — pods must be recreated (\`kubectl rollout restart\`) to see changes. Volume-mounted keys update in place (eventually).

## Requests vs limits

\`\`\`yaml
resources:
  requests: { cpu: 250m, memory: 128Mi }   # what the SCHEDULER reserves
  limits:   { cpu: 500m, memory: 256Mi }   # what the runtime ENFORCES
\`\`\`

- Requests decide placement — sum of requests > node capacity ⇒ Pending, \`Insufficient cpu\`.
- Over CPU limit → throttled. Over memory limit → **OOMKilled** (exit 137).
- LimitRange (per-namespace) injects defaults; ResourceQuota caps namespace totals. A quota'd namespace **rejects pods that don't set requests/limits** — surprise failure mode when a create suddenly errors.

## HPA: one command plus context

\`\`\`bash
kubectl autoscale deployment web --min=2 --max=8 --cpu-percent=70
kubectl get hpa
\`\`\`

Scales replicas to hold average CPU at ~70% **of each pod's request** — no CPU request, no math, no scaling (\`<unknown>\` in \`kubectl get hpa\`). Needs metrics-server. HPA overrides manual \`kubectl scale\` within [min, max].

VPA (vertical, adjusts requests) exists as a concept question: HPA = more pods, VPA = bigger pods; don't run both on CPU/memory for the same workload.

## Jobs & CronJobs — the 30-second version

\`\`\`bash
kubectl create job once --image=busybox:1.36 -- echo done
kubectl create cronjob tick --image=busybox:1.36 --schedule="*/5 * * * *" -- date
\`\`\`

Job knobs: \`completions\`, \`parallelism\`, \`backoffLimit\`. Pods use \`restartPolicy: Never\` or \`OnFailure\` — never \`Always\` (that's what makes it a Job, not a Deployment).
`,
  tips: [
    {
      type: "exam-tip",
      text: "HPA shows <unknown> targets? The pods lack a CPU request. Fix the Deployment's resources.requests.cpu first — the HPA itself is fine.",
    },
    {
      type: "exam-tip",
      text: "--from-literal repeats per key in one command. For files: --from-file=key=./path. Never build a Secret's base64 by hand — create secret generic does it.",
    },
    {
      type: "deep-dive",
      text: "Secrets are base64-encoded, not encrypted — anyone who can GET the object reads the value. Real protection = RBAC on secrets + encryption-at-rest in etcd (EncryptionConfiguration).",
    },
    {
      type: "deep-dive",
      text: "QoS classes follow from resources: Guaranteed (requests=limits), Burstable, BestEffort (none set). Under node memory pressure, kubelet evicts BestEffort first, Guaranteed last.",
    },
  ],
};

export default lesson;
