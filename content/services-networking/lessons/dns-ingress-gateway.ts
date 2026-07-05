import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "sn-dns-ingress-gateway",
  domainId: "services-networking",
  title: "DNS, Ingress and Gateway API: what the exam actually asks",
  estMinutes: 12,
  body: `
## CoreDNS in two minutes

Cluster DNS = CoreDNS pods in \`kube-system\`, exposed by the \`kube-dns\` Service. Every pod's \`/etc/resolv.conf\` points there.

Name patterns to recall on demand:

- Service: \`<svc>.<ns>.svc.cluster.local\`
- Pod (rarely used): \`<ip-with-dashes>.<ns>.pod.cluster.local\`
- Same namespace → bare \`<svc>\` works; cross-namespace → at least \`<svc>.<ns>\`.

Debug flow when resolution fails:

\`\`\`bash
kubectl get pods -n kube-system -l k8s-app=kube-dns     # CoreDNS running?
kubectl run tmp --image=busybox:1.36 --rm -it --restart=Never -- nslookup kubernetes.default
kubectl get cm coredns -n kube-system -o yaml            # the Corefile, if config is suspect
\`\`\`

## Ingress: one YAML shape

L7 HTTP routing into the cluster: host + path → Service. No imperative command worth using — know the shape:

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
spec:
  ingressClassName: nginx
  rules:
  - host: shop.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
\`\`\`

Gotchas the exam likes:

- \`pathType\` is required: \`Prefix\` or \`Exact\` (\`Prefix\` for nearly everything).
- \`ingressClassName\` must name an existing IngressClass, or no controller picks the Ingress up — it just sits there.
- The backend Service still needs working endpoints; Ingress adds routing, it fixes nothing beneath it.

## Gateway API: the successor (now on the CKA)

Same job, split across roles:

| Object | Owned by | Says |
|---|---|---|
| \`GatewayClass\` | infra provider | "this controller implements gateways" |
| \`Gateway\` | cluster operator | "open listener :80/:443 here" |
| \`HTTPRoute\` | app team | "host/path → my Service" |

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
spec:
  parentRefs:
  - name: main-gateway
  hostnames: ["shop.example.com"]
  rules:
  - matches:
    - path: { type: PathPrefix, value: / }
    backendRefs:
    - name: web-svc
      port: 80
\`\`\`

Know the three-object hierarchy and that an \`HTTPRoute\` attaches to a \`Gateway\` via \`parentRefs\` — that's the depth the exam tests today.
`,
  tips: [
    {
      type: "exam-tip",
      text: "Ingress questions are mostly YAML-accuracy checks: pathType present, ingressClassName correct, backend service+port real. Verify with kubectl describe ingress — it shows the resolved backends.",
    },
    {
      type: "exam-tip",
      text: "Gateway API mnemonic: Class = who implements, Gateway = where traffic enters, HTTPRoute = where it goes. Route→Gateway linkage is parentRefs.",
    },
    {
      type: "deep-dive",
      text: "CoreDNS's Corefile lives in the coredns ConfigMap; the kubernetes plugin serves cluster.local, the forward plugin sends the rest upstream. Editing it + rolling the deployment is how you add custom DNS.",
    },
    {
      type: "deep-dive",
      text: "Ingress is feature-frozen upstream — new routing features (header matching, traffic splitting, TCP routes) land only in Gateway API. Expect the exam's weight to keep shifting there.",
    },
  ],
};

export default lesson;
