import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as pty from "node-pty";

export const REPO_ROOT = path.resolve(__dirname, "..");
export const KUBECONFIG_PATH =
  process.env.KUBECONFIG ?? path.join(REPO_ROOT, ".kubeconfig");

const SHELLRC = path.join(__dirname, "shellrc.sh");

// The bridge process's own PATH, captured once. The restricted session PATH
// below deliberately excludes almost everything, so we resolve the tools we DO
// allow against this full PATH rather than against the locked-down session one.
const SYSTEM_PATH = process.env.PATH ?? "";

function resolveBinary(name: string): string | null {
  for (const dir of SYSTEM_PATH.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // not here — keep scanning
    }
  }
  return null;
}

// The exercise shell runs restricted (rbash / `bash -r`): no `cd`, no PATH
// changes, no output redirection, and no running a command by absolute/relative
// path. Combined with a PATH that points only at ALLOWED_BINARIES, this means a
// session can invoke kubectl, the etcd tools, and a handful of read-only text
// filters for pipes — and nothing else. So even if the WS origin/bind guards in
// index.ts are ever bypassed, it can't turn into a general host shell or
// arbitrary command execution. Input redirection (`<`, heredocs) is still
// permitted, so `kubectl apply -f -` and paste-a-manifest workflows keep working.
//
// The text filters (grep/jq/wc/sort/head/tail/cut/tr) exist so real workflows
// like `kubectl get events | grep x` and `kubectl get pods -o json | jq ...`
// work. They are deliberately picked to have NO shell-escape: `less` (`!cmd`),
// `awk` (`system()`), and `sed` (GNU `e` command) are excluded on purpose —
// same risk class, they'd reopen arbitrary command execution.
const ALLOWED_BINARIES = [
  "kubectl",
  "etcdctl",
  "etcdutl",
  "vim",
  "grep",
  "jq",
  "wc",
  "sort",
  "head",
  "tail",
  "cut",
  "tr",
];
const RESTRICTED_SHELL = resolveBinary("rbash") ?? resolveBinary("bash") ?? "bash";
const SHELL_IS_RBASH = path.basename(RESTRICTED_SHELL) === "rbash";

/** A dir containing symlinks to only the allowlisted binaries; it becomes the
 *  session's entire PATH. Built once at startup. */
function buildRestrictedBinDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cka-trainer-rbin-"));
  for (const name of ALLOWED_BINARIES) {
    const target = resolveBinary(name);
    if (!target) continue;
    try {
      fs.symlinkSync(target, path.join(dir, name));
    } catch {
      // duplicate / race — the symlink already exists, fine
    }
  }
  return dir;
}

const RESTRICTED_BIN_DIR = buildRestrictedBinDir();

/** Root shell inside a kind node container — for node-level scenarios (etcd
 *  backup/restore). This one is INTENTIONALLY a full shell: the exercise's task
 *  is to edit the etcd static-pod manifest and relocate `/var/lib/etcd` on the
 *  node itself, which a kubectl-only shell cannot do. It only spawns for the
 *  handful of exercises whose config sets `scenarioNode`, and it execs into a
 *  kind node container (not the bridge host). See docker-compose.yml for why the
 *  docker socket is mounted. */
export function spawnNodeShell(node: string, cols: number, rows: number): pty.IPty {
  return pty.spawn("docker", ["exec", "-it", node, "bash"], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: os.homedir(),
    env: { ...process.env },
  });
}

export function spawnShell(
  cols: number,
  rows: number,
  kubeconfigPath: string = KUBECONFIG_PATH,
): pty.IPty {
  // rbash is restricted by name; plain bash needs `-r`. Long options must
  // precede short ones, or bash rejects the invocation.
  const args = SHELL_IS_RBASH
    ? ["--rcfile", SHELLRC, "-i"]
    : ["--rcfile", SHELLRC, "-r", "-i"];
  return pty.spawn(RESTRICTED_SHELL, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd: os.homedir(),
    // Minimal env: don't leak the bridge's own environment into the session.
    env: {
      HOME: os.homedir(),
      TERM: "xterm-256color",
      LANG: process.env.LANG ?? "C.UTF-8",
      KUBECONFIG: kubeconfigPath,
      // Restricted vim (`-Z`): usable as $KUBE_EDITOR for `kubectl edit`, but
      // its `:!cmd` / `:shell` escapes are disabled, so it can't be a shell.
      EDITOR: "vim -Z",
      KUBE_EDITOR: "vim -Z",
      // The session's entire PATH: only the allowlisted binaries above.
      PATH: RESTRICTED_BIN_DIR,
    },
  });
}
