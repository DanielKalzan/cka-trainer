import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "sn-services-fast",
  domainId: "services-networking",
  title: "Services at exam speed: expose, don't write YAML",
  estMinutes: 10,
  body: `
Every Service task starts imperatively. \`kubectl expose\` copies the target's selector for you — that alone kills the #1 mistake (selector typos).

\`\`\`bash
kubectl expose deployment web --name=web-svc --port=80 --target-port=8080
kubectl expose pod db --port=5432                       # selector = the pod's labels
kubectl create service nodeport hits --tcp=80:8080      # when there's nothing to expose yet
\`\`\`

## The three numbers, straight

| Field | Who connects to it | Notes |
|---|---|---|
| \`port\` | other pods, via the ClusterIP | the Service's own port |
| \`targetPort\` | the container | defaults to \`port\` if omitted — a classic silent bug |
| \`nodePort\` | external clients, via any node IP | NodePort type only; range 30000–32767 |

Traffic path for NodePort: \`nodeIP:nodePort → clusterIP:port → podIP:targetPort\`.

## Service types in one breath

- **ClusterIP** (default) — internal virtual IP. 95% of tasks.
- **NodePort** — ClusterIP + a static port on every node. To pin the port number, edit the Service after creation (\`nodePort: 30080\`) — \`expose\` can't set it.
- **LoadBalancer** — NodePort + cloud LB. On exam clusters it stays \`<pending>\`; that's expected, not broken.
- **ExternalName** — DNS CNAME, no proxying, no selector.

## Verify like a grader

\`\`\`bash
kubectl get svc web-svc                    # type, clusterIP, ports
kubectl describe svc web-svc               # Endpoints must NOT be empty
kubectl get pods -l app=web -o wide        # the IPs behind those endpoints
\`\`\`

Empty \`Endpoints:\` in describe = selector matches nothing (or pods aren't Ready). Fix that before touching anything network-deeper — no endpoints means no Service, whatever the type.

## DNS names you get for free

Within the same namespace: \`web-svc\`. Cross-namespace: \`web-svc.shop\` or the full \`web-svc.shop.svc.cluster.local\`. Pods get \`/etc/resolv.conf\` search domains that make the short forms work.
`,
  tips: [
    {
      type: "exam-tip",
      text: "expose --port is the SERVICE port, --target-port is the CONTAINER port. If the app listens on 8080 and the task says 'expose on 80', you need both flags.",
    },
    {
      type: "exam-tip",
      text: "Need an exact nodePort (e.g. 30080)? Create the Service first, then kubectl edit svc and set spec.ports[0].nodePort. No imperative flag reliably does it.",
    },
    {
      type: "deep-dive",
      text: "kube-proxy implements Services with iptables/IPVS rules on every node — a Service is not a process anywhere, which is why 'restart the service' is never the answer.",
    },
    {
      type: "deep-dive",
      text: "sessionAffinity: ClientIP pins a client to one backend pod — the only load-balancing knob a plain Service offers.",
    },
  ],
};

export default lesson;
