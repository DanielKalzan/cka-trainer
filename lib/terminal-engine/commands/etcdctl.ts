import type { ClusterState } from "../cluster-state";
import { formatTable, pseudoHash } from "../format";
import { flagStr, type ParsedCommand } from "../parser";
import { err, ok, type ExecResult } from "./helpers";

/**
 * Mocked etcdctl/etcdutl. No real etcd state is modeled — the commands are
 * validated for exam-correct shape and recorded so checkers can grade them.
 */
export function handleEtcdctl(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const [sub, action, pathArg] = cmd.args;
  if (sub !== "snapshot") {
    return err(`Error: unknown command "${sub ?? ""}" for "etcdctl" (simulator supports: snapshot save|restore|status)`);
  }

  switch (action) {
    case "save": {
      if (!pathArg) return err("Error: snapshot save requires a file path argument");
      const cacert = flagStr(cmd, "--cacert");
      const cert = flagStr(cmd, "--cert");
      const key = flagStr(cmd, "--key");
      if (!cacert || !cert || !key) {
        // What you actually see when the TLS flags are missing
        return err(
          `{"level":"warn","msg":"retrying of unary invoker failed","target":"etcd-endpoints://127.0.0.1:2379","error":"rpc error: code = DeadlineExceeded desc = latest balancer error: connection error: desc = \\"transport: authentication handshake failed\\""}\nError: context deadline exceeded\n\n(hint: etcd requires mTLS — pass --cacert, --cert and --key)`,
        );
      }
      const looksRight = (p: string | undefined, name: string) => p?.includes(name);
      if (
        !looksRight(cacert, "ca.crt") ||
        !looksRight(cert, "server.crt") ||
        !looksRight(key, "server.key")
      ) {
        return err(
          `Error: open ${cacert}: no such file or directory\n\n(hint: on a kubeadm cluster the etcd certs live in /etc/kubernetes/pki/etcd/ — ca.crt, server.crt, server.key)`,
        );
      }
      state.etcd.snapshotsSaved.push(pathArg);
      const hash = pseudoHash(pathArg, 8, "0123456789abcdef");
      return ok(
        `{"level":"info","ts":"2026-07-05T12:00:01.000Z","caller":"snapshot/v3_snapshot.go:65","msg":"created temporary db file","path":"${pathArg}.part"}\n{"level":"info","ts":"2026-07-05T12:00:01.400Z","caller":"snapshot/v3_snapshot.go:73","msg":"fetching snapshot","endpoint":"https://127.0.0.1:2379"}\n{"level":"info","ts":"2026-07-05T12:00:01.900Z","caller":"snapshot/v3_snapshot.go:88","msg":"fetched snapshot","endpoint":"https://127.0.0.1:2379","size":"5.1 MB","took":"now"}\nSnapshot saved at ${pathArg}\n(sha256: ${hash})`,
      );
    }

    case "restore": {
      if (!pathArg) return err("Error: snapshot restore requires a file path argument");
      if (!state.etcd.snapshotsSaved.includes(pathArg)) {
        return err(`Error: stat ${pathArg}: no such file or directory`);
      }
      const dataDir = flagStr(cmd, "--data-dir");
      if (!dataDir) {
        return err(
          `Deprecated: Use "etcdutl snapshot restore" instead.\nError: data-dir "default.etcd" exists\n\n(hint: pass --data-dir pointing at a NEW directory, e.g. --data-dir=/var/lib/etcd-restored)`,
        );
      }
      state.etcd.restoredFrom = { snapshotPath: pathArg, dataDir };
      return ok(
        `Deprecated: Use "etcdutl snapshot restore" instead.\n\n2026-07-05T12:00:02Z	info	snapshot/v3_snapshot.go:248	restoring snapshot	{"path": "${pathArg}", "wal-dir": "${dataDir}/member/wal", "data-dir": "${dataDir}"}\n2026-07-05T12:00:02Z	info	membership/store.go:141	Trimming membership information from the backend...\n2026-07-05T12:00:02Z	info	snapshot/v3_snapshot.go:269	restored snapshot	{"path": "${pathArg}", "data-dir": "${dataDir}"}`,
      );
    }

    case "status": {
      if (!pathArg) return err("Error: snapshot status requires a file path argument");
      if (!state.etcd.snapshotsSaved.includes(pathArg)) {
        return err(`Error: stat ${pathArg}: no such file or directory`);
      }
      const hash = pseudoHash(pathArg, 8, "0123456789abcdef");
      return ok(
        formatTable(
          ["HASH", "REVISION", "TOTAL KEYS", "TOTAL SIZE"],
          [[hash, "4821", "1053", "5.1 MB"]],
        ),
      );
    }

    default:
      return err(`Error: unknown snapshot subcommand "${action ?? ""}" (save, restore, status)`);
  }
}
