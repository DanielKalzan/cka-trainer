/**
 * Cheatsheet data — the muscle-memory command set for exam day.
 * Pure data; the page renders it, adding entries never touches components.
 */

export interface CheatItem {
  cmd: string;
  note?: string;
}

export interface CheatSection {
  id: string;
  title: string;
  items: CheatItem[];
}

export const CHEATSHEET: CheatSection[] = [
  {
    id: "setup",
    title: "First 60 seconds of the exam",
    items: [
      { cmd: "alias k=kubectl", note: "usually preset — verify, don't assume" },
      {
        cmd: 'export do="--dry-run=client -o yaml"',
        note: "then: k create deploy web --image=nginx $do > d.yaml",
      },
      { cmd: 'export now="--force --grace-period=0"', note: "fast pod deletes: k delete pod x $now" },
      { cmd: "kubectl config use-context <name>", note: "EVERY task states its context — switch first, always" },
      { cmd: "kubectl explain deployment.spec.strategy", note: "in-exam docs for any field path" },
    ],
  },
  {
    id: "yaml-fast",
    title: "Generate YAML, never write it from scratch",
    items: [
      { cmd: "k create deployment web --image=nginx:1.27 --replicas=3 $do > deploy.yaml" },
      { cmd: "k run tmp --image=busybox:1.36 $do -- sh -c 'sleep 3600' > pod.yaml" },
      { cmd: "k expose deployment web --port=80 --target-port=8080 $do > svc.yaml" },
      { cmd: "k create job once --image=busybox:1.36 $do -- echo done > job.yaml" },
      { cmd: "k get pod broken -o yaml > pod.yaml", note: "edit, then: k replace --force -f pod.yaml" },
    ],
  },
  {
    id: "imperative",
    title: "Objects with imperative creates",
    items: [
      { cmd: "k create configmap cfg --from-literal=KEY=val --from-file=app.conf=./app.conf" },
      { cmd: "k create secret generic creds --from-literal=password='S3cret!'" },
      { cmd: "k create namespace team-a" },
      { cmd: "k create serviceaccount ci-bot -n build" },
      { cmd: 'k create cronjob tick --image=busybox:1.36 --schedule="*/5 * * * *" -- date' },
      { cmd: "k create quota q1 --hard=pods=10,cpu=2 -n team-a" },
    ],
  },
  {
    id: "rbac",
    title: "RBAC — imperative or bust",
    items: [
      { cmd: "k create role r --verb=get,list,watch --resource=pods -n dev" },
      { cmd: "k create rolebinding rb --role=r --serviceaccount=dev:app-sa -n dev", note: "SA format NAMESPACE:NAME — mandatory" },
      { cmd: "k create clusterrole cr --verb=get,list --resource=nodes" },
      { cmd: "k create clusterrolebinding crb --clusterrole=cr --user=jane" },
      { cmd: "k auth can-i delete pods --as=system:serviceaccount:dev:app-sa -n dev", note: "your self-check AND sometimes the task" },
    ],
  },
  {
    id: "rollouts",
    title: "Deployments: roll, verify, roll back",
    items: [
      { cmd: "k set image deployment/web nginx=nginx:1.28", note: "CONTAINER=IMAGE — container name, not deployment" },
      { cmd: "k rollout status deployment/web", note: "blocks until done — proof of completion" },
      { cmd: "k rollout history deployment/web --revision=2" },
      { cmd: "k rollout undo deployment/web --to-revision=2" },
      { cmd: "k rollout restart deployment/web", note: "fresh pods, same spec — re-reads ConfigMaps" },
      { cmd: "k scale deployment web --replicas=5", note: "no new revision — scaling ≠ rollout" },
      { cmd: "k autoscale deployment web --min=2 --max=8 --cpu-percent=70", note: "needs CPU requests or HPA shows <unknown>" },
    ],
  },
  {
    id: "nodes",
    title: "Nodes & scheduling",
    items: [
      { cmd: "k drain node01 --ignore-daemonsets --delete-emptydir-data", note: "cordon included; --force for bare pods" },
      { cmd: "k uncordon node01", note: "the forgotten final step of every maintenance task" },
      { cmd: "k taint node node01 dedicated=gpu:NoSchedule", note: "effects: NoSchedule | PreferNoSchedule | NoExecute" },
      { cmd: "k taint node node01 dedicated-", note: "trailing dash removes" },
      { cmd: "k label node node01 disk=ssd", note: "remove with: k label node node01 disk-" },
      { cmd: "k top nodes && k top pods -A --sort-by=memory", note: "needs metrics-server" },
    ],
  },
  {
    id: "triage",
    title: "Troubleshooting loop",
    items: [
      { cmd: "k get pods -A -o wide", note: "STATUS column decides the next command" },
      { cmd: "k describe pod <name>", note: "read Events bottom-up — the answer is planted there" },
      { cmd: "k logs <pod> --previous", note: "CrashLoopBackOff: the evidence is in the PREVIOUS container" },
      { cmd: "k get events -A --sort-by=.metadata.creationTimestamp", note: "cluster-wide timeline" },
      { cmd: "k exec -it <pod> -- sh", note: "-c <container> for multi-container pods" },
      { cmd: "k describe svc <name>", note: "Endpoints empty → selector/labels/readiness problem" },
      { cmd: "ssh node01; systemctl status kubelet; journalctl -u kubelet", note: "NotReady node = kubelet first, always" },
      { cmd: "ls /etc/kubernetes/manifests/", note: "static pods — broken control plane lives here" },
    ],
  },
  {
    id: "etcd",
    title: "etcd backup & restore",
    items: [
      {
        cmd: "etcdctl snapshot save /opt/backup/etcd.db \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key",
        note: "endpoint + 3 TLS flags; cert paths readable from the etcd static pod manifest",
      },
      {
        cmd: "etcdctl snapshot restore /opt/backup/etcd.db --data-dir=/var/lib/etcd-restored",
        note: "no TLS flags; finish by pointing etcd.yaml's hostPath at the new dir",
      },
    ],
  },
  {
    id: "output",
    title: "Output & selection tricks",
    items: [
      { cmd: "k get pods -l app=web --show-labels" },
      { cmd: "k get pods -o jsonpath='{.items[*].metadata.name}'" },
      { cmd: "k get pods -A --sort-by=.status.startTime" },
      { cmd: "k get pods -o custom-columns=NAME:.metadata.name,IMG:.spec.containers[0].image" },
      { cmd: "k get deploy web -o yaml | less", note: "faster than describe when you need exact field names" },
      { cmd: "watch kubectl get pods", note: "or: k get pods -w" },
    ],
  },
  {
    id: "skeletons",
    title: "YAML you must produce from memory",
    items: [
      {
        cmd: "# NetworkPolicy core\nspec:\n  podSelector:          # WHO is protected\n    matchLabels: {app: db}\n  policyTypes: [Ingress]\n  ingress:\n  - from:\n    - podSelector:      # WHO may connect\n        matchLabels: {app: web}\n    ports:\n    - {protocol: TCP, port: 5432}",
        note: "no imperative command exists — this one is memorization",
      },
      {
        cmd: "# Pod → PVC mount\nvolumes:\n- name: data\n  persistentVolumeClaim: {claimName: my-claim}\ncontainers:\n- volumeMounts:\n  - {name: data, mountPath: /var/data}",
      },
      {
        cmd: "# Toleration matching taint key=val:NoSchedule\ntolerations:\n- key: key\n  operator: Equal\n  value: val\n  effect: NoSchedule",
      },
    ],
  },
];
