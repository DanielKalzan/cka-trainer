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

/** Live sessions owned by open WS connections, keyed by activeKey (namespace for
 *  namespace exercises, a token for scenarios). Any labeled namespace whose name
 *  isn't a key here is an orphan. Holding the full session objects (not just the
 *  keys) lets the shutdown handler tear them down gracefully on SIGINT/SIGTERM. */
const liveSessions = new Map<string, ExerciseSession>();

/** Serialize setup/teardown for a given exerciseId so a reset can't interleave
 *  them. A reset remounts the terminal, which closes the old socket (→ teardown)
 *  before opening the new one (→ setup); this lock makes teardown finish before
 *  the new setup starts, so for node-level exercises the old session's restore
 *  (taint/cordon removal, `rm -rf /opt/backup`) can't land on top of — and wipe
 *  out — the new session's freshly-applied fault. Namespaces are timestamped, so
 *  namespace exercises never collide; this is about the shared node state. */
const exerciseLocks = new Map<string, Promise<void>>();
function withExerciseLock<T>(exerciseId: string, fn: () => Promise<T>): Promise<T> {
  const prev = exerciseLocks.get(exerciseId) ?? Promise.resolve();
  const result = prev.then(fn, fn); // run after the previous op settles, pass or fail
  const tail = result.then(
    () => {},
    () => {},
  );
  exerciseLocks.set(exerciseId, tail);
  void tail.finally(() => {
    if (exerciseLocks.get(exerciseId) === tail) exerciseLocks.delete(exerciseId);
  });
  return result;
}

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

export function createExerciseSession(exerciseId: string): Promise<ExerciseSession> {
  return withExerciseLock(exerciseId, () => createExerciseSessionLocked(exerciseId));
}

async function createExerciseSessionLocked(exerciseId: string): Promise<ExerciseSession> {
  const exercise = getExerciseById(exerciseId);
  if (!exercise?.live) {
    throw new Error(`exercise ${exerciseId} is not available in live mode`);
  }
  if (liveSessions.size >= MAX_SESSIONS) {
    throw new Error("too many active exercise sessions — close other exercise tabs");
  }

  if (exercise.live.scenario) {
    const scenario = SCENARIOS[exercise.live.scenario];
    if (!scenario) throw new Error(`unknown scenario ${exercise.live.scenario}`);
    await exec("bash", [scenarioScript(exercise.live.scenario, "setup")], { cwd: REPO_ROOT });
    const activeKey = `scenario-${exerciseId}-${Date.now()}`;
    const session: ExerciseSession = {
      exerciseId,
      namespace: null,
      kubeconfigPath: null,
      scenarioNode: scenario.node,
      activeKey,
    };
    liveSessions.set(activeKey, session);
    return session;
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

  const session: ExerciseSession = {
    exerciseId,
    namespace,
    kubeconfigPath,
    scenarioNode: null,
    activeKey: namespace,
  };
  liveSessions.set(namespace, session);
  return session;
}

/** Parse the exerciseId back out of a session namespace name (`ex-<id>-<ts>`),
 *  so the orphan sweep can look the exercise up and run its cluster-scoped
 *  cleanup. The trailing `-<digits>` is the Date.now() timestamp. */
function exerciseIdFromNamespace(namespace: string): string | undefined {
  return /^ex-(.+)-\d+$/.exec(namespace)?.[1];
}

/** Undo everything a namespace exercise created: the namespace itself, any
 *  cluster-scoped objects it added (PVs, StorageClasses — not covered by the
 *  namespace delete), any node mutations it made (taints/cordons, via the
 *  exercise's teardownCommands), and its per-session kubeconfig file. Shared by
 *  normal teardown and the orphan sweep so a crash can't leave half of it behind. */
async function cleanupNamespaceArtifacts(
  exerciseId: string | undefined,
  namespace: string,
  kubeconfigPath: string | null,
  includeShared = true,
): Promise<void> {
  const live = exerciseId ? getExerciseById(exerciseId)?.live : undefined;
  if (kubeconfigPath) fs.rmSync(kubeconfigPath, { force: true });
  // Cluster-scoped objects (fixed names) and node mutations (one shared node) are
  // shared across sessions of the same exercise. Skip them when a newer session
  // for that exercise is already live — it owns that state now (see teardown).
  // The namespace itself is per-session (timestamped) and is always safe to delete.
  const cleanups = includeShared ? (live?.clusterScopedCleanup ?? []) : [];
  const restores = includeShared ? (live?.teardownCommands ?? []) : [];
  const results = await Promise.allSettled([
    kubectl("delete", "namespace", namespace, "--wait=false", "--ignore-not-found"),
    ...cleanups.map((ref) =>
      kubectl("delete", ref.kind.toLowerCase(), ref.name, "--wait=false", "--ignore-not-found"),
    ),
    // Restores fail routinely (user already removed the taint/cordon) — ignore.
    ...restores.map((cmd) => kubectl(...cmd).catch(() => "")),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn(`[bridge] cleanup of ${namespace}: ${r.reason}`);
    }
  }
}

export function teardownExerciseSession(session: ExerciseSession): Promise<void> {
  return withExerciseLock(session.exerciseId, () => teardownExerciseSessionLocked(session));
}

async function teardownExerciseSessionLocked(session: ExerciseSession): Promise<void> {
  liveSessions.delete(session.activeKey);
  const live = getExerciseById(session.exerciseId)?.live;
  // A reset creates a new session for the same exercise; the mutex keeps the old
  // teardown and new setup from interleaving, but not from running in either
  // order. If a newer session for this exercise is now live, it owns the shared
  // node/cluster state — skip our restores so we don't wipe out its fresh fault.
  const supersededByNewer = [...liveSessions.values()].some(
    (s) => s.exerciseId === session.exerciseId,
  );
  if (live?.scenario) {
    // Scenario teardown (`rm -rf /opt/backup` etc.) touches only shared node
    // state — if a newer session owns it, leave it for that session to clean up.
    if (supersededByNewer) return;
    try {
      await exec("bash", [scenarioScript(live.scenario, "teardown")], { cwd: REPO_ROOT });
    } catch (err) {
      console.warn(`[bridge] scenario teardown ${live.scenario}: ${(err as Error).message}`);
    }
    return;
  }
  if (!session.namespace) return;
  await cleanupNamespaceArtifacts(
    session.exerciseId,
    session.namespace,
    session.kubeconfigPath,
    !supersededByNewer,
  );
}

/** Tear down every live session — for graceful shutdown on SIGINT/SIGTERM, so a
 *  Ctrl-C (or `concurrently -k`) doesn't leave node taints/cordons, cluster-scoped
 *  objects, or scenario node-state behind for the next run to trip over. */
export async function teardownAllSessions(): Promise<void> {
  const sessions = [...liveSessions.values()];
  await Promise.allSettled(sessions.map((session) => teardownExerciseSession(session)));
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

/** Clean up labeled namespaces no live session owns — crashed bridge, killed
 *  tab, etc. Not just the namespace: also the exercise's cluster-scoped objects
 *  and node mutations (taints/cordons/PVs/StorageClasses), which a namespace
 *  delete leaves behind and which would otherwise corrupt a later exercise's
 *  grading. The exerciseId is recovered from the namespace name. */
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
    const orphans = out.trim().split(/\s+/).filter((ns) => ns && !liveSessions.has(ns));
    for (const ns of orphans) {
      console.log(`[bridge] sweeping orphan namespace ${ns}`);
      const kubeconfigPath = path.join(SESSION_DIR, `${ns}.yaml`);
      await cleanupNamespaceArtifacts(exerciseIdFromNamespace(ns), ns, kubeconfigPath);
    }
  } catch (err) {
    console.warn(`[bridge] orphan sweep skipped: ${(err as Error).message}`);
  }
}
