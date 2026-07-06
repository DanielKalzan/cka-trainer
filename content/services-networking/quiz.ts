import type { QuizQuestion } from "@/lib/types/content";

const quiz: QuizQuestion[] = [
  {
    id: "sn-q-expose",
    domainId: "services-networking",
    type: "command-fill",
    prompt:
      "One command: expose deployment `web` as a ClusterIP service named `web-svc`, service port 80, container port 8080.",
    correctAnswer: "kubectl expose deployment web --name=web-svc --port=80 --target-port=8080",
    acceptableAnswers: [
      "kubectl expose deployment web --name=web-svc --port=80 --target-port=8080",
      "kubectl expose deploy web --name=web-svc --port=80 --target-port=8080",
      "kubectl expose deployment web --port=80 --target-port=8080 --name=web-svc",
      "k expose deployment web --name=web-svc --port=80 --target-port=8080",
      "k expose deploy web --name=web-svc --port=80 --target-port=8080",
    ],
    explanation:
      "expose copies the deployment's selector automatically — the safest way to create a Service. --port is the service side, --target-port the container side; ClusterIP is the default type.",
  },
  {
    id: "sn-q-nodeport-path",
    domainId: "services-networking",
    type: "multiple-choice",
    prompt: "For a NodePort service (port 80, targetPort 8080, nodePort 30080), an EXTERNAL client connects to:",
    options: [
      "any node's IP on 30080",
      "the ClusterIP on 30080",
      "any node's IP on 80",
      "the pod IP on 8080",
    ],
    correctAnswer: "any node's IP on 30080",
    explanation:
      "nodePort opens 30080 on every node; kube-proxy forwards nodeIP:30080 → clusterIP:80 → podIP:8080. ClusterIP:80 keeps working too, but only from inside the cluster.",
  },
  {
    id: "sn-q-netpol-default",
    domainId: "services-networking",
    type: "multiple-choice",
    prompt: "Namespace `prod` has no NetworkPolicies at all. What can its pods receive?",
    options: [
      "All traffic — no policy selecting a pod means default allow",
      "Nothing — Kubernetes is default-deny",
      "Only traffic from within prod",
      "Only traffic from kube-system",
    ],
    correctAnswer: "All traffic — no policy selecting a pod means default allow",
    explanation:
      "NetworkPolicies only restrict. A pod becomes default-deny for a direction only once at least one policy selects it with that direction in policyTypes.",
  },
  {
    id: "sn-q-netpol-and-or",
    domainId: "services-networking",
    type: "multiple-choice",
    prompt:
      "In an ingress `from:` list, what changes when `namespaceSelector` and `podSelector` are merged into ONE list item instead of two separate `-` items?",
    options: [
      "OR becomes AND — only matching pods in matching namespaces are allowed",
      "Nothing, both spellings are equivalent",
      "AND becomes OR — more traffic is allowed",
      "The policy becomes invalid and is rejected",
    ],
    correctAnswer: "OR becomes AND — only matching pods in matching namespaces are allowed",
    explanation:
      "Separate list items are OR'd; selectors inside a single item are AND'd. One misplaced dash makes a policy radically more (or less) permissive — the exam's favorite netpol trap.",
  },
  {
    id: "sn-q-dns-cross-ns",
    domainId: "services-networking",
    type: "command-fill",
    prompt:
      "A pod in namespace `frontend` needs the shortest DNS name that reaches service `db` in namespace `backend`. What is it?",
    correctAnswer: "db.backend",
    acceptableAnswers: ["db.backend", "db.backend.svc", "db.backend.svc.cluster.local"],
    explanation:
      "Bare `db` only resolves within the same namespace. Cross-namespace requires at least <svc>.<ns>; the search domains in resolv.conf complete the rest.",
  },
  {
    id: "sn-q-ingress-pathtype",
    domainId: "services-networking",
    type: "yaml-fix",
    prompt: `This Ingress is rejected by the API server. What's missing?

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
spec:
  ingressClassName: nginx
  rules:
  - host: shop.example.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: web-svc
            port:
              number: 80
\`\`\``,
    correctAnswer: "pathType",
    acceptableAnswers: ["pathType", "pathType: Prefix", "the pathType field", "pathType field"],
    explanation:
      "Every path entry requires pathType (Prefix or Exact) in networking.k8s.io/v1 — omitting it fails validation. Prefix is the right choice for `/`.",
  },
  {
    id: "sn-q-gateway-route",
    domainId: "services-networking",
    type: "multiple-choice",
    prompt: "In the Gateway API, how does an HTTPRoute get attached to a Gateway?",
    options: [
      "Via the route's spec.parentRefs naming the Gateway",
      "Via a gatewayClassName field on the route",
      "The Gateway lists its routes in spec.routes",
      "By matching labels between Gateway and HTTPRoute",
    ],
    correctAnswer: "Via the route's spec.parentRefs naming the Gateway",
    explanation:
      "Routes point at their Gateway (parentRefs), not the other way round — app teams attach routes without touching the operator-owned Gateway. GatewayClass sits above both, naming the implementing controller.",
  },
  {
    id: "sn-q-headless-svc",
    domainId: "services-networking",
    type: "multiple-choice",
    prompt: "Service `db` is created with `clusterIP: None`. What changes about its DNS?",
    options: [
      "db.<ns>.svc.cluster.local resolves to the individual Pod IPs (multiple A records), not one virtual IP",
      "The Service gets no DNS entry at all",
      "DNS still returns a single virtual IP, but kube-proxy stops load-balancing it",
      "Only StatefulSet pods can resolve it",
    ],
    correctAnswer:
      "db.<ns>.svc.cluster.local resolves to the individual Pod IPs (multiple A records), not one virtual IP",
    explanation:
      "A headless Service skips ClusterIP allocation and kube-proxy load-balancing entirely — CoreDNS instead returns one A record per Ready backing Pod, letting clients (or StatefulSet peers) discover and connect to specific pods directly.",
  },
  {
    id: "sn-q-svc-no-selector",
    domainId: "services-networking",
    type: "multiple-choice",
    prompt:
      "A Service is created with no `spec.selector` (backing an external database via its own IP). What must you create manually?",
    options: [
      "An Endpoints (or EndpointSlice) object with the same name as the Service, listing the external IP(s)",
      "Nothing — Kubernetes DNS resolves to the external host automatically",
      "A separate Ingress to bridge into the Service",
      "The Service must instead use type: ExternalName",
    ],
    correctAnswer:
      "An Endpoints (or EndpointSlice) object with the same name as the Service, listing the external IP(s)",
    explanation:
      "Without a selector, Kubernetes has no way to auto-populate endpoints, so you supply them yourself via an Endpoints/EndpointSlice object matching the Service's name — kube-proxy then load-balances to those addresses exactly like a normal Service. (ExternalName is a different, DNS-only mechanism — no ClusterIP or proxying at all.)",
  },
  {
    id: "sn-q-netpol-empty-podselector",
    domainId: "services-networking",
    type: "multiple-choice",
    prompt: "A NetworkPolicy in `prod` has `podSelector: {}` and an empty `ingress: []`. Which pods does it affect?",
    options: [
      "Every pod in prod — and since no ingress rule is listed, all of them become ingress-default-deny",
      "No pods — an empty podSelector matches nothing",
      "Only pods with no labels at all",
      "It's invalid and rejected by the API server",
    ],
    correctAnswer: "Every pod in prod — and since no ingress rule is listed, all of them become ingress-default-deny",
    explanation:
      "podSelector: {} is the 'match everything' selector, not 'match nothing' — it's the standard idiom for a namespace-wide default-deny policy. Pairing it with an empty ingress list (and Ingress in policyTypes) blocks all inbound traffic that isn't allowed by some other policy.",
  },
  {
    id: "sn-q-netpol-egress-default",
    domainId: "services-networking",
    type: "multiple-choice",
    prompt:
      "Pod `web` is already selected by a NetworkPolicy restricting its INGRESS. Its egress to the internet suddenly stops working after you add a second NetworkPolicy, also selecting `web`, with only `Egress` in policyTypes and one narrow egress rule. Why?",
    options: [
      "Adding any policy with Egress in policyTypes makes that pod egress-default-deny, and only that policy's own rules apply for egress",
      "NetworkPolicies for the same pod always conflict and the newest one wins entirely, disabling the first",
      "Egress policies are ignored unless a matching Ingress policy also exists",
      "This is a bug — egress should be unaffected by an ingress-only policy",
    ],
    correctAnswer:
      "Adding any policy with Egress in policyTypes makes that pod egress-default-deny, and only that policy's own rules apply for egress",
    explanation:
      "Each direction (ingress/egress) becomes default-deny independently, the moment ANY policy selecting that pod lists that direction in policyTypes. A pod with no policy mentioning egress has unrestricted egress — until one does, at which point only explicitly allowed egress across all such policies gets through.",
  },
  {
    id: "sn-q-externalname",
    domainId: "services-networking",
    type: "command-fill",
    prompt:
      "Which Service `type` returns a CNAME to an external DNS name instead of getting a ClusterIP or being proxied at all?",
    correctAnswer: "ExternalName",
    acceptableAnswers: ["ExternalName", "type: ExternalName"],
    explanation:
      "ExternalName Services are pure DNS aliases (CNAME to spec.externalName) — no ClusterIP is allocated and kube-proxy never touches them; the client's own DNS resolution does all the work.",
  },
  {
    id: "sn-q-session-affinity",
    domainId: "services-networking",
    type: "command-fill",
    prompt:
      "Which Service field, set to `ClientIP`, pins a client to the same backend Pod across multiple requests?",
    correctAnswer: "sessionAffinity",
    acceptableAnswers: ["sessionAffinity", "spec.sessionAffinity", "sessionAffinity: ClientIP"],
    explanation:
      "sessionAffinity: ClientIP makes kube-proxy route all traffic from the same source IP to the same backend Pod, instead of the default spreading across all endpoints.",
  },
  {
    id: "sn-q-multiport-name-required",
    domainId: "services-networking",
    type: "yaml-fix",
    prompt: `This Service is rejected by the API server. What's missing?

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 8080
  - port: 443
    targetPort: 8443
\`\`\``,
    correctAnswer: "Each port needs a unique name — required whenever a Service defines more than one port",
    acceptableAnswers: [
      "add name: to each port",
      "ports need a name field",
      "name is required for multi-port Services",
    ],
    explanation:
      "A single-port Service can omit `name`, but the moment a Service lists more than one port, every entry must have a unique `name` so the port list is unambiguous.",
  },
  {
    id: "sn-q-coredns-configmap",
    domainId: "services-networking",
    type: "command-fill",
    prompt: "Which ConfigMap, in namespace `kube-system`, holds CoreDNS's `Corefile` configuration?",
    correctAnswer: "coredns",
    acceptableAnswers: ["coredns", "configmap/coredns", "kubectl -n kube-system get configmap coredns"],
    explanation:
      "CoreDNS's entire config lives in the `coredns` ConfigMap's Corefile key; editing it and letting CoreDNS pick it up (auto-reload, or a rollout restart) is how you customize cluster DNS behavior (stub domains, upstream forwarders, etc.).",
  },
];

export default quiz;
