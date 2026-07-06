import { describe, expect, it } from "vitest";
import exercises from "@/content/cluster-architecture/exercises";
import { emptyClusterState, makeNode, type ClusterState } from "./cluster-state";
import { applyYamlText, executeCommand } from "./engine";
import { parseCommand } from "./parser";
import { sandboxState } from "./fixtures/sandbox";

function fresh(): ClusterState {
  const s = emptyClusterState();
  s.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  return s;
}

// Only the etcd exercise still carries sim fields — the rest run live.
function exerciseState(id: string): ClusterState {
  const ex = exercises.find((e) => e.id === id);
  if (!ex?.initialState) throw new Error(`no sim exercise ${id}`);
  return structuredClone(ex.initialState);
}

function checker(id: string) {
  return exercises.find((e) => e.id === id)!.checker!;
}

describe("parser", () => {
  it("handles --flag=value, -n space form, booleans and quotes", () => {
    const cmd = parseCommand(
      `kubectl create configmap app -n dev --from-literal=a=1 --from-literal="b=hello world" --show-labels`,
    );
    expect(cmd.bin).toBe("kubectl");
    expect(cmd.args).toEqual(["create", "configmap", "app"]);
    expect(cmd.flags["--namespace"]).toBe("dev");
    expect(cmd.flags["--show-labels"]).toBe(true);
    expect(cmd.repeated["--from-literal"]).toEqual(["a=1", "b=hello world"]);
  });

  it("captures trailing command after --", () => {
    const cmd = parseCommand("kubectl exec -it web -- sh -c 'echo hi'");
    expect(cmd.trailing).toEqual(["sh", "-c", "echo hi"]);
  });

  it("treats bare --dry-run as client", () => {
    const cmd = parseCommand("kubectl create deployment web --image=nginx --dry-run -o yaml");
    expect(cmd.flags["--dry-run"]).toBe("client");
    expect(cmd.flags["--output"]).toBe("yaml");
  });
});

describe("get / describe", () => {
  it("prints aligned columns for get nodes", () => {
    const out = executeCommand(fresh(), "kubectl get nodes");
    expect(out.exitCode).toBe(0);
    expect(out.output).toMatch(/NAME\s+STATUS\s+ROLES\s+AGE\s+VERSION/);
    expect(out.output).toMatch(/controlplane\s+Ready\s+control-plane/);
    expect(out.output).toMatch(/node01\s+Ready\s+<none>/);
  });

  it("respects namespaces and -A", () => {
    const s = sandboxState();
    expect(executeCommand(s, "kubectl get pods -n kube-system").output).toContain(
      "No resources found",
    );
    const all = executeCommand(s, "kubectl get pods -A").output;
    expect(all).toMatch(/NAMESPACE/);
    expect(all).toContain("web-");
  });

  it("get pod -o yaml round-trips through apply", () => {
    const s = sandboxState();
    const yaml = executeCommand(s, "kubectl get pod debugger -o yaml").output;
    expect(yaml).toContain("kind: Pod");
    expect(yaml).not.toContain("mockLogs");
    const s2 = fresh();
    const res = applyYamlText(s2, yaml);
    expect(res.exitCode).toBe(0);
    expect(s2.pods).toHaveLength(1);
  });

  it("describe pod shows container state and events", () => {
    const s = sandboxState();
    const out = executeCommand(s, "kubectl describe pod debugger").output;
    expect(out).toContain("ImagePullBackOff");
    expect(out).toContain("Failed to pull image");
  });
});

describe("create / run / expose", () => {
  it("create deployment spawns replicaset and pods", () => {
    const s = fresh();
    executeCommand(s, "kubectl create deployment web --image=nginx --replicas=3");
    expect(s.deployments).toHaveLength(1);
    expect(s.replicasets).toHaveLength(1);
    expect(s.pods).toHaveLength(3);
    const out = executeCommand(s, "kubectl get deploy").output;
    expect(out).toMatch(/web\s+3\/3/);
  });

  it("--dry-run=client -o yaml emits YAML without mutating state", () => {
    const s = fresh();
    const out = executeCommand(
      s,
      "kubectl create deployment web --image=nginx --dry-run=client -o yaml",
    );
    expect(out.output).toContain("kind: Deployment");
    expect(out.output).toContain("image: nginx");
    expect(s.deployments).toHaveLength(0);
  });

  it("run creates a pod; expose creates a service with the pod's selector", () => {
    const s = fresh();
    executeCommand(s, "kubectl run web --image=nginx --port=80");
    expect(s.pods).toHaveLength(1);
    const res = executeCommand(s, "kubectl expose pod web --port=80 --name=web-svc");
    expect(res.exitCode).toBe(0);
    expect(s.services[0].spec.selector).toEqual({ run: "web" });
  });
});

describe("scale / set image / rollout", () => {
  it("scale changes pod count", () => {
    const s = fresh();
    executeCommand(s, "kubectl create deployment api --image=httpd --replicas=1");
    executeCommand(s, "kubectl scale deployment api --replicas=4");
    expect(s.pods).toHaveLength(4);
  });

  it("set image bumps revision; rollout undo reverts", () => {
    const s = fresh();
    executeCommand(s, "kubectl create deployment api --image=nginx:1.26");
    executeCommand(s, "kubectl set image deployment/api api=nginx:1.27");
    expect(s.deployments[0].spec.template.spec.containers[0].image).toBe("nginx:1.27");
    const hist = executeCommand(s, "kubectl rollout history deployment/api").output;
    expect(hist).toContain("2");
    executeCommand(s, "kubectl rollout undo deployment/api");
    expect(s.deployments[0].spec.template.spec.containers[0].image).toBe("nginx:1.26");
  });
});

describe("delete", () => {
  it("deleting an RS-owned pod recreates a replacement", () => {
    const s = fresh();
    executeCommand(s, "kubectl create deployment web --image=nginx --replicas=2");
    const victim = s.pods[0].metadata.name;
    executeCommand(s, `kubectl delete pod ${victim}`);
    expect(s.pods).toHaveLength(2);
    expect(s.pods.some((p) => p.metadata.name === victim)).toBe(false);
  });

  it("deleting a deployment cascades to pods", () => {
    const s = fresh();
    executeCommand(s, "kubectl create deployment web --image=nginx --replicas=2");
    executeCommand(s, "kubectl delete deployment web");
    expect(s.pods).toHaveLength(0);
    expect(s.replicasets).toHaveLength(0);
  });
});

describe("node ops", () => {
  it("cordon marks SchedulingDisabled in get nodes", () => {
    const s = fresh();
    executeCommand(s, "kubectl cordon node01");
    const out = executeCommand(s, "kubectl get nodes").output;
    expect(out).toMatch(/node01\s+Ready,SchedulingDisabled/);
  });

  it("drain requires --ignore-daemonsets when DS pods exist, then evicts", () => {
    // Local fixture: the node-maintenance exercise runs live now, but the sim
    // engine's drain semantics stay covered until the engine is deleted.
    const s = fresh();
    executeCommand(s, "kubectl create deployment web --image=nginx:1.27 --replicas=2");
    s.pods.forEach((p) => (p.spec.nodeName = "node01"));
    s.pods.push({
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: "kube-proxy-r7t2w",
        namespace: "kube-system",
        labels: { "k8s-app": "kube-proxy" },
        creationTimestamp: "2026-07-04T10:00:00Z",
        annotations: { "kubernetes.io/managed-by": "DaemonSet" },
      },
      spec: { containers: [{ name: "kube-proxy", image: "registry.k8s.io/kube-proxy" }], nodeName: "node01" },
      status: { phase: "Running" },
    });
    const refuse = executeCommand(s, "kubectl drain node01");
    expect(refuse.exitCode).toBe(1);
    expect(refuse.output).toContain("--ignore-daemonsets");
    const res = executeCommand(s, "kubectl drain node01 --ignore-daemonsets");
    expect(res.exitCode).toBe(0);
    expect(s.nodes[1].spec.unschedulable).toBe(true);
    const strays = s.pods.filter(
      (p) =>
        p.spec.nodeName === "node01" &&
        p.metadata.annotations?.["kubernetes.io/managed-by"] !== "DaemonSet",
    );
    expect(strays).toHaveLength(0);
  });

  it("taint add and remove", () => {
    const s = fresh();
    executeCommand(s, "kubectl taint nodes node01 dedicated=gpu:NoSchedule");
    expect(s.nodes[1].spec.taints).toContainEqual({
      key: "dedicated",
      value: "gpu",
      effect: "NoSchedule",
    });
    executeCommand(s, "kubectl taint nodes node01 dedicated:NoSchedule-");
    expect(s.nodes[1].spec.taints).toHaveLength(0);
  });
});

describe("etcdctl (mocked)", () => {
  it("refuses snapshot save without TLS flags", () => {
    const s = exerciseState("ca-ex-etcd-backup-restore");
    const res = executeCommand(s, "etcdctl snapshot save /opt/backup/etcd-snapshot.db");
    expect(res.exitCode).toBe(1);
    expect(res.output).toContain("--cacert");
  });

  it("full backup+restore passes the exercise checker", () => {
    const s = exerciseState("ca-ex-etcd-backup-restore");
    const save = executeCommand(
      s,
      "ETCDCTL_API=3 etcdctl snapshot save /opt/backup/etcd-snapshot.db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key",
    );
    expect(save.exitCode).toBe(0);
    expect(save.output).toContain("Snapshot saved");
    const restore = executeCommand(
      s,
      "etcdctl snapshot restore /opt/backup/etcd-snapshot.db --data-dir=/var/lib/etcd-restored",
    );
    expect(restore.exitCode).toBe(0);
    expect(checker("ca-ex-etcd-backup-restore")(s).passed).toBe(true);
  });
});

describe("RBAC end-to-end", () => {
  it("imperative SA + role + rolebinding grants exactly what auth can-i reports", () => {
    const s = fresh();
    executeCommand(s, "kubectl create namespace build");
    executeCommand(s, "kubectl create serviceaccount ci-bot -n build");
    executeCommand(
      s,
      "kubectl create role deploy-manager --verb=get,list,create,update,delete --resource=deployments -n build",
    );
    executeCommand(
      s,
      "kubectl create rolebinding ci-bot-deploy --role=deploy-manager --serviceaccount=build:ci-bot -n build",
    );
    expect(s.serviceaccounts.some((a) => a.metadata.name === "ci-bot")).toBe(true);
    expect(s.roles.some((r) => r.metadata.name === "deploy-manager")).toBe(true);
    expect(s.rolebindings.some((b) => b.metadata.name === "ci-bot-deploy")).toBe(true);

    const yes = executeCommand(
      s,
      "kubectl auth can-i delete deployments --as=system:serviceaccount:build:ci-bot -n build",
    );
    expect(yes.output).toBe("yes");
    const no = executeCommand(
      s,
      "kubectl auth can-i delete pods --as=system:serviceaccount:build:ci-bot -n build",
    );
    expect(no.output).toBe("no");
  });
});

describe("apply / edit YAML paths", () => {
  it("apply creates a pod from pasted YAML", () => {
    const s = fresh();
    const res = applyYamlText(
      s,
      `apiVersion: v1
kind: Pod
metadata:
  name: manual-pod
  labels:
    app: manual
spec:
  containers:
    - name: main
      image: nginx:1.27`,
    );
    expect(res.exitCode).toBe(0);
    expect(res.output).toContain("pod/manual-pod created");
    expect(s.pods[0].status.phase).toBe("Running");
  });

  it("apply updates an existing deployment and reconciles pods", () => {
    const s = fresh();
    executeCommand(s, "kubectl create deployment web --image=nginx --replicas=1");
    const yaml = executeCommand(s, "kubectl get deployment web -o yaml").output;
    const res = applyYamlText(s, yaml.replace("replicas: 1", "replicas: 3"));
    expect(res.output).toContain("configured");
    expect(s.pods).toHaveLength(3);
  });
});

describe("misc", () => {
  it("config use-context / current-context", () => {
    const s = fresh();
    s.contexts.push({ name: "staging", cluster: "staging", user: "dev" });
    executeCommand(s, "kubectl config use-context staging");
    expect(executeCommand(s, "kubectl config current-context").output).toBe("staging");
  });

  it("logs returns mocked output", () => {
    const s = fresh();
    s.pods.push({
      apiVersion: "v1",
      kind: "Pod",
      metadata: { name: "app", namespace: "default" },
      spec: { containers: [{ name: "app", image: "x" }] },
      status: { phase: "Running", containerStatuses: [{ name: "app", ready: true, restartCount: 0, state: "Running" }] },
      mockLogs: { "": "line1\nline2\nline3" },
    });
    expect(executeCommand(s, "kubectl logs app").output).toBe("line1\nline2\nline3");
    expect(executeCommand(s, "kubectl logs app --tail=1").output).toBe("line3");
  });

  it("unknown binaries and verbs fail cleanly", () => {
    const s = fresh();
    expect(executeCommand(s, "docker ps").exitCode).toBe(1);
    expect(executeCommand(s, "kubectl frobnicate").exitCode).toBe(1);
  });
});
