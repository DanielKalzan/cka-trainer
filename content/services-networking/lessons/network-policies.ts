import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "sn-network-policies",
  domainId: "services-networking",
  title: "NetworkPolicies: the four rules that matter",
  estMinutes: 12,
  body: `
NetworkPolicy is the one networking object with **no imperative command** — you will write this YAML on the exam. Memorize the skeleton; everything else is variations.

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-db
  namespace: prod
spec:
  podSelector:            # WHO this policy protects
    matchLabels:
      app: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:        # WHO may connect
        matchLabels:
          app: web
    ports:
    - protocol: TCP
      port: 5432
\`\`\`

## The four rules

1. **Default allow.** No policy selecting a pod → all traffic flows. Policies only ever *restrict*.
2. **Selection flips the default.** The moment ANY policy selects a pod (via \`podSelector\`) for a direction in \`policyTypes\`, that direction becomes default-deny except what's allowed.
3. **Policies are additive.** Multiple policies on the same pod = union of their allows. There is no deny rule and no ordering.
4. **Empty selector = everything.** \`podSelector: {}\` selects all pods in the namespace. That's how default-deny is written:

\`\`\`yaml
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
\`\`\`

## from/to: the three peer types (and one trap)

\`\`\`yaml
- from:
  - podSelector: { matchLabels: { app: web } }          # pods in THIS namespace
  - namespaceSelector: { matchLabels: { env: prod } }   # all pods in matching namespaces
  - ipBlock: { cidr: 10.0.0.0/16 }
\`\`\`

Those three list items are **OR**. The trap: combine \`namespaceSelector\` and \`podSelector\` in ONE list item (no dash on the second) and they become **AND** — "pods with these labels in namespaces with those labels". One \`-\` changes the meaning entirely.

## Selecting other namespaces

\`podSelector\` under \`from\` only sees the policy's own namespace. Cross-namespace access always needs a \`namespaceSelector\`. Every namespace carries the auto-label \`kubernetes.io/metadata.name: <name>\` — the exam-safe way to target one namespace by name.

## Don't forget egress DNS

A default-deny Egress policy also blocks DNS. Real-world policies almost always include UDP/TCP 53 to kube-system — if the task mentions "pods must still resolve names", that's the expected extra rule.
`,
  tips: [
    {
      type: "exam-tip",
      text: "podSelector inside spec = who is protected. podSelector inside from/to = who may talk. Confusing the two is the classic netpol failure.",
    },
    {
      type: "exam-tip",
      text: "Target a namespace by name with namespaceSelector.matchLabels['kubernetes.io/metadata.name']: <ns> — the label every namespace gets automatically.",
    },
    {
      type: "deep-dive",
      text: "Enforcement is the CNI plugin's job (Calico, Cilium…). On a cluster whose CNI ignores NetworkPolicy, the objects apply cleanly and do nothing — the API server never validates enforcement.",
    },
    {
      type: "deep-dive",
      text: "policyTypes defaults to the directions present in the spec — an ingress-only policy doesn't touch egress unless you list Egress explicitly. Being explicit is cheaper than remembering the default.",
    },
  ],
};

export default lesson;
