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
];

export default quiz;
