import { execFile } from "child_process";
import { promisify } from "util";
import type { CheckResult } from "@/lib/types/content";
import { NODES } from "@/lib/constants/cluster";
import { appsApi, coreApi, orNotFound, rbacApi } from "./client";

const exec = promisify(execFile);

/** Cluster-architecture checkers. */

/** Run a command inside the control-plane node container; null exit = failed. */
async function onControlPlane(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await exec("docker", ["exec", NODES.controlPlane, "bash", "-c", cmd]);
    return stdout;
  } catch {
    return null;
  }
}

/** Node-level exercise — grades files on the control-plane node, not the API.
 *  The namespace argument is unused (scenario sessions have none). */
export async function checkEtcdBackupRestore(): Promise<CheckResult> {
  const saved = await onControlPlane("test -s /opt/backup/etcd-snapshot.db && echo ok");
  if (!saved) {
    return {
      passed: false,
      feedback:
        "No snapshot at /opt/backup/etcd-snapshot.db yet. Remember: etcdctl snapshot save needs the endpoint + three TLS flags.",
    };
  }
  const valid = await onControlPlane(
    "etcdutl snapshot status /opt/backup/etcd-snapshot.db >/dev/null 2>&1 && echo ok",
  );
  if (!valid) {
    return {
      passed: false,
      feedback:
        "/opt/backup/etcd-snapshot.db exists but isn't a valid etcd snapshot — did the save command actually succeed? Check its output.",
    };
  }
  const restored = await onControlPlane("test -d /var/lib/etcd-restored/member && echo ok");
  if (!restored) {
    return {
      passed: false,
      feedback:
        "Snapshot saved ✓ — but nothing has been restored into /var/lib/etcd-restored. Since etcd 3.6 the restore lives in etcdutl, and it needs only --data-dir.",
    };
  }
  return {
    passed: true,
    feedback:
      "Snapshot saved and restored to a fresh data dir. On the real exam, finish by pointing the etcd-data hostPath in /etc/kubernetes/manifests/etcd.yaml at the new directory.",
  };
}

export async function checkRbacCi(namespace: string): Promise<CheckResult> {
  const sa = await orNotFound(
    coreApi().readNamespacedServiceAccount({ name: "ci-bot", namespace }),
  );
  if (!sa) {
    return {
      passed: false,
      feedback: "ServiceAccount ci-bot not found in the terminal's default namespace.",
    };
  }

  const role = await orNotFound(
    rbacApi().readNamespacedRole({ name: "deploy-manager", namespace }),
  );
  if (!role) {
    return { passed: false, feedback: "Role deploy-manager not found." };
  }
  const wanted = ["get", "list", "create", "update", "delete"];
  const coversDeployments = (role.rules ?? []).some(
    (rule) =>
      (rule.resources ?? []).some((res) => res === "deployments" || res === "*") &&
      wanted.every((v) => rule.verbs.includes(v) || rule.verbs.includes("*")),
  );
  if (!coversDeployments) {
    return {
      passed: false,
      feedback:
        "Role deploy-manager exists but its rules don't cover get,list,create,update,delete on deployments.",
    };
  }

  const binding = await orNotFound(
    rbacApi().readNamespacedRoleBinding({ name: "ci-bot-deploy", namespace }),
  );
  if (!binding) {
    return { passed: false, feedback: "RoleBinding ci-bot-deploy not found." };
  }
  const refOk = binding.roleRef.kind === "Role" && binding.roleRef.name === "deploy-manager";
  const subjectOk = (binding.subjects ?? []).some(
    (s) =>
      s.kind === "ServiceAccount" &&
      s.name === "ci-bot" &&
      (s.namespace === namespace || !s.namespace),
  );
  if (!refOk || !subjectOk) {
    return {
      passed: false,
      feedback: !refOk
        ? "ci-bot-deploy doesn't reference Role deploy-manager."
        : `ci-bot-deploy's subject isn't ServiceAccount ${namespace}:ci-bot — remember the NAMESPACE:NAME form.`,
    };
  }
  return {
    passed: true,
    feedback: `Least-privilege chain complete: SA → Role → RoleBinding. Verify trick for the real exam: kubectl auth can-i delete deployments --as=system:serviceaccount:${namespace}:ci-bot.`,
  };
}

export async function checkNodeMaintenance(namespace: string): Promise<CheckResult> {
  const node = await orNotFound(coreApi().readNode({ name: NODES.worker }));
  if (!node) {
    return { passed: false, feedback: `${NODES.worker} disappeared — that's not maintenance, that's murder.` };
  }
  if (!node.spec?.unschedulable) {
    return {
      passed: false,
      feedback: `${NODES.worker} is still schedulable. Cordoning (or draining, which includes it) is required.`,
    };
  }
  const dep = await orNotFound(
    appsApi().readNamespacedDeployment({ name: "web", namespace }),
  );
  if (!dep) {
    return { passed: false, feedback: "The web Deployment is gone — evict its pods, don't delete the workload." };
  }
  const pods = await coreApi().listNamespacedPod({ namespace });
  const strays = pods.items.filter((p) => p.spec?.nodeName === NODES.worker);
  if (strays.length > 0) {
    return {
      passed: false,
      feedback: `${NODES.worker} is cordoned but still runs ${strays.length} pod(s) from this exercise: ${strays
        .map((p) => p.metadata?.name)
        .join(", ")}. Drain it.`,
    };
  }
  return {
    passed: true,
    feedback: `${NODES.worker} cordoned and drained; only DaemonSet pods remain on it. The web pods sitting Pending is expected — they're pinned to this node. Real tasks usually end with uncordon after the maintenance step.`,
  };
}
