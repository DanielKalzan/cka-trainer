import { describe, expect, it } from "vitest";
import { dump, load } from "js-yaml";
import { getAllExercises } from "@/lib/content/registry";
import troubleshooting from "@/content/troubleshooting/exercises";
import networking from "@/content/services-networking/exercises";
import workloads from "@/content/workloads-scheduling/exercises";
import storage from "@/content/storage/exercises";
import type { TerminalExercise } from "@/lib/types/content";
import type { ClusterState } from "./cluster-state";
import { applyEditedYaml, applyYamlText, executeCommand } from "./engine";

const ALL = [...troubleshooting, ...networking, ...workloads, ...storage];

function exercise(id: string): TerminalExercise {
  const ex = ALL.find((e) => e.id === id);
  if (!ex) throw new Error(`no exercise ${id}`);
  return ex;
}

function start(id: string): { state: ClusterState; ex: TerminalExercise } {
  const ex = exercise(id);
  return { state: structuredClone(ex.initialState), ex };
}

function run(state: ClusterState, input: string) {
  const res = executeCommand(state, input);
  expect(res.exitCode, `${input}\n${res.output}`).toBe(0);
  return res;
}

/** Simulate the terminal's `kubectl edit` flow: open editor, mutate the object, save. */
function editObject(
  state: ClusterState,
  editCmd: string,
  mutate: (doc: Record<string, unknown>) => void,
) {
  const res = run(state, editCmd);
  expect(res.editor).toBeDefined();
  const doc = load(res.editor!.initialYaml) as Record<string, unknown>;
  mutate(doc);
  const saved = applyEditedYaml(state, res.editor!.target!, dump(doc));
  expect(saved.exitCode, saved.output).toBe(0);
}

describe("every exercise starts unsolved", () => {
  for (const ex of getAllExercises()) {
    it(ex.id, () => {
      expect(ex.checker(structuredClone(ex.initialState)).passed).toBe(false);
    });
  }
});

describe("troubleshooting exercises", () => {
  it("ts-ex-imagepull: set image fixes the deployment", () => {
    const { state, ex } = start("ts-ex-imagepull");
    run(state, "kubectl set image deployment/web web=nginx:1.27-alpine");
    const verdict = ex.checker(state);
    expect(verdict.feedback).toBeTruthy();
    expect(verdict.passed).toBe(true);
  });

  it("ts-ex-crashloop: logs reveal the missing env var; edit deploy fixes it", () => {
    const { state, ex } = start("ts-ex-crashloop");
    const logs = run(state, "kubectl logs api-5f6d8b9c7-w4jns");
    expect(logs.output).toContain("DB_HOST");
    editObject(state, "kubectl edit deployment api", (doc) => {
      const d = doc as {
        spec: { template: { spec: { containers: { env?: unknown[] }[] } } };
      };
      d.spec.template.spec.containers[0].env = [
        { name: "DB_HOST", value: "db.default.svc.cluster.local" },
      ];
    });
    expect(ex.checker(state).passed).toBe(true);
  });

  it("ts-ex-svc-selector: fixing the service selector passes", () => {
    const { state, ex } = start("ts-ex-svc-selector");
    editObject(state, "kubectl edit svc catalog-svc -n shop", (doc) => {
      (doc as { spec: { selector: Record<string, string> } }).spec.selector = { app: "catalog" };
    });
    expect(ex.checker(state).passed).toBe(true);
  });

  it("ts-ex-taint-pending: untaint + delete pending pods reschedules", () => {
    const { state, ex } = start("ts-ex-taint-pending");
    run(state, "kubectl taint node node01 maintenance-");
    expect(ex.checker(state).passed).toBe(false); // pods still Pending until recreated
    run(state, "kubectl delete pod -l app=queue");
    const verdict = ex.checker(state);
    expect(verdict.passed).toBe(true);
  });
});

describe("services & networking exercises", () => {
  it("sn-ex-expose: kubectl expose with name/port/target-port", () => {
    const { state, ex } = start("sn-ex-expose");
    run(state, "kubectl expose deployment frontend --name=frontend-svc --port=80 --target-port=8080");
    expect(ex.checker(state).passed).toBe(true);
  });

  it("sn-ex-nodeport: expose then pin nodePort via edit", () => {
    const { state, ex } = start("sn-ex-nodeport");
    run(
      state,
      "kubectl expose deployment hits --name=hits-svc --type=NodePort --port=80 --target-port=3000",
    );
    expect(ex.checker(state).passed).toBe(false); // random nodePort ≠ 30080
    editObject(state, "kubectl edit svc hits-svc", (doc) => {
      (doc as { spec: { ports: { nodePort?: number }[] } }).spec.ports[0].nodePort = 30080;
    });
    expect(ex.checker(state).passed).toBe(true);
  });

  it("sn-ex-netpol: applying the solution YAML passes; wrong podSelector fails", () => {
    const { state, ex } = start("sn-ex-netpol");
    const yaml = `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-db
  namespace: prod
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web
    ports:
    - protocol: TCP
      port: 5432
`;
    const res = applyYamlText(state, yaml);
    expect(res.exitCode, res.output).toBe(0);
    expect(ex.checker(state).passed).toBe(true);

    // swapped selectors (the classic mistake) must fail
    const swapped = structuredClone(exercise("sn-ex-netpol").initialState);
    applyYamlText(
      swapped,
      yaml.replace("app: db", "app: TMP").replace("app: web", "app: db").replace("app: TMP", "app: web"),
    );
    expect(exercise("sn-ex-netpol").checker(swapped).passed).toBe(false);
  });
});

describe("workloads & scheduling exercises", () => {
  it("ws-ex-rollback: rollout undo restores 1.9 and pods run", () => {
    const { state, ex } = start("ws-ex-rollback");
    run(state, "kubectl rollout undo deployment/payments");
    expect(ex.checker(state).passed).toBe(true);
  });

  it("ws-ex-scale-autoscale: scale + autoscale", () => {
    const { state, ex } = start("ws-ex-scale-autoscale");
    run(state, "kubectl scale deployment worker --replicas=6");
    expect(ex.checker(state).passed).toBe(false); // HPA still missing
    run(state, "kubectl autoscale deployment api --min=2 --max=8 --cpu-percent=70");
    expect(ex.checker(state).passed).toBe(true);
  });

  it("ws-ex-dedicated-node: taint + label + tolerating pod", () => {
    const { state, ex } = start("ws-ex-dedicated-node");
    run(state, "kubectl taint node node02 dedicated=cache:NoSchedule");
    run(state, "kubectl label node node02 role=cache");
    const res = applyYamlText(
      state,
      `
apiVersion: v1
kind: Pod
metadata:
  name: cache-1
spec:
  nodeSelector:
    role: cache
  tolerations:
  - key: dedicated
    operator: Equal
    value: cache
    effect: NoSchedule
  containers:
  - name: cache-1
    image: redis:7.4
`,
    );
    expect(res.exitCode, res.output).toBe(0);
    expect(ex.checker(state).passed).toBe(true);
  });
});

describe("storage exercises", () => {
  it("st-ex-pv-pvc-pod: PV + PVC + pod chain", () => {
    const { state, ex } = start("st-ex-pv-pvc-pod");
    const res = applyYamlText(
      state,
      `
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-logs
spec:
  capacity:
    storage: 1Gi
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  hostPath:
    path: /mnt/logs
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: logs-claim
  namespace: default
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  resources:
    requests:
      storage: 500Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: log-writer
spec:
  containers:
  - name: log-writer
    image: busybox:1.36
    command: ["sh", "-c", "sleep 3600"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  volumes:
  - name: logs
    persistentVolumeClaim:
      claimName: logs-claim
`,
    );
    expect(res.exitCode, res.output).toBe(0);
    expect(ex.checker(state).passed).toBe(true);
  });

  it("st-ex-storageclass: SC + PVC", () => {
    const { state, ex } = start("st-ex-storageclass");
    const res = applyYamlText(
      state,
      `
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-local
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: cache-claim
  namespace: default
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-local
  resources:
    requests:
      storage: 2Gi
`,
    );
    expect(res.exitCode, res.output).toBe(0);
    expect(ex.checker(state).passed).toBe(true);
  });
});
