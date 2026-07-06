import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { CheckResult } from "@/lib/types/content";
import { getExerciseById } from "@/lib/content/registry";
import { getLiveChecker } from "@/lib/checkers";
import { KUBECONFIG_PATH, REPO_ROOT } from "./pty";

const exec = promisify(execFile);

const MANAGED_LABEL = "app.kubernetes.io/managed-by=cka-trainer";
const SESSION_DIR = path.join(os.tmpdir(), "cka-trainer-sessions");
/** Safety cap — a stuck client reconnect loop must not flood the local cluster. */
const MAX_SESSIONS = 10;

/** Node-level scenarios: setup/teardown scripts under /scripts/scenarios/<id>,
 *  PTY shells into the named kind node instead of a kubectl shell. */
const SCENARIOS: Record<string, { node: string }> = {
  "etcd-backup-restore": { node: "cka-trainer-control-plane" },
};

export interface ExerciseSession {
  exerciseId: string;
  /** null for scenario (node-level) sessions — they have no session namespace. */
  namespace: string | null;
  kubeconfigPath: string | null;
  /** kind node the PTY shells into; null = regular kubectl shell. */
  scenarioNode: string | null;
  /** Key in the active-session set (namespace, or a token for scenarios). */
  activeKey: string;
}

/** Namespaces owned by live WS connections — everything else with our label is an orphan. */
const active = new Set<string>();

function scenarioScript(id: string, phase: "setup" | "teardown"): string {
  return path.join(REPO_ROOT, "scripts", "scenarios", id, `${phase}.sh`);
}

async function kubectl(...args: string[]): Promise<string> {
  // cwd = repo root so setup commands can `apply -f content/...` with repo-relative paths.
  const { stdout } = await exec("kubectl", ["--kubeconfig", KUBECONFIG_PATH, ...args], {
    cwd: REPO_ROOT,
  });
  return stdout;
}

export async function createExerciseSession(exerciseId: string): Promise<ExerciseSession> {
  const exercise = getExerciseById(exerciseId);
  if (!exercise?.live) {
    throw new Error(`exercise ${exerciseId} is not available in live mode`);
  }
  if (active.size >= MAX_SESSIONS) {
    throw new Error("too many active exercise sessions — close other exercise tabs");
  }

  if (exercise.live.scenario) {
    const scenario = SCENARIOS[exercise.live.scenario];
    if (!scenario) throw new Error(`unknown scenario ${exercise.live.scenario}`);
    await exec("bash", [scenarioScript(exercise.live.scenario, "setup")], { cwd: REPO_ROOT });
    const activeKey = `scenario-${exerciseId}-${Date.now()}`;
    active.add(activeKey);
    return {
      exerciseId,
      namespace: null,
      kubeconfigPath: null,
      scenarioNode: scenario.node,
      activeKey,
    };
  }

  const namespace = `ex-${exerciseId}-${Date.now()}`;
  await kubectl("create", "namespace", namespace);
  try {
    await kubectl("label", "namespace", namespace, MANAGED_LABEL);
    if (exercise.live.manifest) {
      await kubectl("apply", "-n", namespace, "-f", path.join(REPO_ROOT, exercise.live.manifest));
    }
    // -n is a harmless no-op for cluster-scoped commands (taint, cordon, …).
    for (const cmd of exercise.live.setupCommands ?? []) {
      await kubectl("-n", namespace, ...cmd);
    }
  } catch (err) {
    // Half-provisioned setup: don't leave the namespace (or a node taint) behind.
    await Promise.allSettled([
      kubectl("delete", "namespace", namespace, "--wait=false", "--ignore-not-found"),
      ...(exercise.live.teardownCommands ?? []).map((cmd) => kubectl(...cmd).catch(() => "")),
    ]);
    throw err;
  }

  // Per-session kubeconfig with the exercise namespace as the context default,
  // so bare `kubectl get pods` in the PTY targets the session namespace.
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const kubeconfigPath = path.join(SESSION_DIR, `${namespace}.yaml`);
  fs.copyFileSync(KUBECONFIG_PATH, kubeconfigPath);
  await exec("kubectl", [
    "--kubeconfig",
    kubeconfigPath,
    "config",
    "set-context",
    "--current",
    `--namespace=${namespace}`,
  ]);

  active.add(namespace);
  return { exerciseId, namespace, kubeconfigPath, scenarioNode: null, activeKey: namespace };
}

export async function teardownExerciseSession(session: ExerciseSession): Promise<void> {
  active.delete(session.activeKey);
  const live = getExerciseById(session.exerciseId)?.live;
  if (live?.scenario) {
    try {
      await exec("bash", [scenarioScript(live.scenario, "teardown")], { cwd: REPO_ROOT });
    } catch (err) {
      console.warn(`[bridge] scenario teardown ${live.scenario}: ${(err as Error).message}`);
    }
    return;
  }
  if (!session.namespace || !session.kubeconfigPath) return;
  fs.rmSync(session.kubeconfigPath, { force: true });
  const cleanups = live?.clusterScopedCleanup ?? [];
  const restores = live?.teardownCommands ?? [];
  const results = await Promise.allSettled([
    kubectl("delete", "namespace", session.namespace, "--wait=false", "--ignore-not-found"),
    ...cleanups.map((ref) =>
      kubectl("delete", ref.kind.toLowerCase(), ref.name, "--wait=false", "--ignore-not-found"),
    ),
    // Restores fail routinely (user already removed the taint/cordon) — ignore.
    ...restores.map((cmd) => kubectl(...cmd).catch(() => "")),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn(`[bridge] teardown of ${session.namespace}: ${r.reason}`);
    }
  }
}

export async function runCheck(session: ExerciseSession): Promise<CheckResult> {
  const checker = getLiveChecker(session.exerciseId);
  if (!checker) {
    return { passed: false, feedback: `No checker registered for ${session.exerciseId}.` };
  }
  try {
    // Scenario sessions have no namespace — their checkers ignore the argument.
    return await checker(session.namespace ?? "");
  } catch (err) {
    return {
      passed: false,
      feedback: `Checker could not reach the cluster: ${(err as Error).message}. Is the kind cluster up?`,
    };
  }
}

/** Delete labeled namespaces no live session owns — crashed bridge, killed tab, etc. */
export async function sweepOrphanNamespaces(): Promise<void> {
  try {
    const out = await kubectl(
      "get",
      "namespaces",
      "-l",
      MANAGED_LABEL,
      "-o",
      "jsonpath={.items[*].metadata.name}",
    );
    const orphans = out.trim().split(/\s+/).filter((ns) => ns && !active.has(ns));
    for (const ns of orphans) {
      console.log(`[bridge] sweeping orphan namespace ${ns}`);
      await kubectl("delete", "namespace", ns, "--wait=false", "--ignore-not-found");
    }
  } catch (err) {
    console.warn(`[bridge] orphan sweep skipped: ${(err as Error).message}`);
  }
}
