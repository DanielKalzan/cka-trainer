import * as os from "os";
import * as path from "path";
import * as pty from "node-pty";

export const REPO_ROOT = path.resolve(__dirname, "..");
export const KUBECONFIG_PATH =
  process.env.KUBECONFIG ?? path.join(REPO_ROOT, ".kubeconfig");

const SHELLRC = path.join(__dirname, "shellrc.sh");

/** Root shell inside a kind node container — for node-level scenarios (etcd
 *  backup, kubelet surgery). Needs the docker CLI + socket, same as kind itself. */
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
  return pty.spawn("bash", ["--rcfile", SHELLRC, "-i"], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: os.homedir(),
    env: {
      ...process.env,
      KUBECONFIG: kubeconfigPath,
      EDITOR: "vim",
      KUBE_EDITOR: "vim",
      // Repo-local ./bin first so an auto-downloaded kind is reachable in-session.
      PATH: `${path.join(REPO_ROOT, "bin")}:${process.env.PATH ?? ""}`,
    },
  });
}
