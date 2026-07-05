import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ca-rbac-fast",
  domainId: "cluster-architecture",
  title: "RBAC at exam speed: imperative or bust",
  estMinutes: 10,
  body: `
Never write RBAC YAML by hand on the exam. Every RBAC object has an imperative \`kubectl create\` form, and they compose in two moves: **rule object** (Role/ClusterRole) + **binding** (RoleBinding/ClusterRoleBinding).

## The four commands

\`\`\`bash
kubectl create role pod-reader --verb=get,list,watch --resource=pods -n dev

kubectl create rolebinding pod-reader-binding \\
  --role=pod-reader --serviceaccount=dev:app-sa -n dev

kubectl create clusterrole node-reader --verb=get,list --resource=nodes

kubectl create clusterrolebinding node-reader-binding \\
  --clusterrole=node-reader --user=jane
\`\`\`

Subjects: \`--user=\`, \`--group=\`, or \`--serviceaccount=NAMESPACE:NAME\` (the namespace prefix on SAs is mandatory and the #1 typo).

## Choosing the right pair

| Need | Use |
|---|---|
| Namespaced resources, one namespace | Role + RoleBinding |
| Cluster-scoped resources (nodes, PVs, namespaces) | ClusterRole + ClusterRoleBinding |
| Same rules reused across namespaces | ClusterRole + RoleBinding **per namespace** |

That third row is the exam's favorite subtlety: a RoleBinding can reference a ClusterRole, granting its rules only within the binding's namespace.

## Verify in one line

\`\`\`bash
kubectl auth can-i list pods --as=system:serviceaccount:dev:app-sa -n dev
kubectl auth can-i delete nodes --as=jane
\`\`\`

\`auth can-i\` with \`--as=\` is both your self-check and occasionally the task itself. For a ServiceAccount the \`--as\` string is always \`system:serviceaccount:<ns>:<name>\`.

## Sub-resources and named resources

Rules can target sub-resources (\`--resource=pods/log\`) and specific objects (\`--resource-name=my-config\`). \`kubectl create role\` supports both flags — still no YAML needed:

\`\`\`bash
kubectl create role log-reader --verb=get --resource=pods/log -n dev
\`\`\`
`,
  tips: [
    {
      type: "exam-tip",
      text: "Memorize cold: --serviceaccount=NAMESPACE:NAME format, and the auth can-i --as=system:serviceaccount:<ns>:<name> incantation.",
    },
    {
      type: "exam-tip",
      text: "ClusterRole + RoleBinding = cluster-wide rules scoped to one namespace. If a task says 'use the existing ClusterRole but only in namespace X', this is it.",
    },
    {
      type: "deep-dive",
      text: "RBAC is purely additive — there is no deny rule. If access unexpectedly works, some other binding grants it; kubectl auth can-i --list --as=<subject> shows the union.",
    },
    {
      type: "deep-dive",
      text: "Default ClusterRoles admin/edit/view are aggregation targets; custom ClusterRoles labeled rbac.authorization.k8s.io/aggregate-to-view roll into view automatically.",
    },
  ],
};

export default lesson;
