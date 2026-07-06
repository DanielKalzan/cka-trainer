import type { CheckResult } from "@/lib/types/content";
import {
  checkEtcdBackupRestore,
  checkNodeMaintenance,
  checkRbacCi,
} from "./cluster-architecture";
import { checkExpose, checkNetpol, checkNetpolFix, checkNodePort } from "./services-networking";
import { checkPvcMismatch, checkPvPvcPod, checkStorageClassClaim } from "./storage";
import {
  checkCoreDnsNetpol,
  checkCrashLoop,
  checkImagePull,
  checkNodeCordoned,
  checkOomKilled,
  checkRbacForbidden,
  checkSvcSelector,
  checkTaintPending,
} from "./troubleshooting";
import {
  checkAffinityPending,
  checkDedicatedNode,
  checkRollback,
  checkScaleAutoscale,
} from "./workloads-scheduling";

/**
 * Server-side checker registry, keyed by exercise id. The bridge resolves an
 * exercise's checker here; content files never import this module (it pulls in
 * @kubernetes/client-node, which must stay out of the client bundle).
 */

export type LiveChecker = (namespace: string) => Promise<CheckResult>;

const CHECKERS: Record<string, LiveChecker> = {
  "ca-ex-etcd-backup-restore": checkEtcdBackupRestore,
  "ca-ex-rbac-ci": checkRbacCi,
  "ca-ex-node-maintenance": checkNodeMaintenance,
  "sn-ex-expose": checkExpose,
  "sn-ex-nodeport": checkNodePort,
  "sn-ex-netpol": checkNetpol,
  "sn-ex-netpol-fix": checkNetpolFix,
  "st-ex-pv-pvc-pod": checkPvPvcPod,
  "st-ex-storageclass": checkStorageClassClaim,
  "st-ex-pvc-mismatch": checkPvcMismatch,
  "ts-ex-imagepull": checkImagePull,
  "ts-ex-crashloop": checkCrashLoop,
  "ts-ex-svc-selector": checkSvcSelector,
  "ts-ex-taint-pending": checkTaintPending,
  "ts-ex-oomkilled": checkOomKilled,
  "ts-ex-rbac-forbidden": checkRbacForbidden,
  "ts-ex-coredns-netpol": checkCoreDnsNetpol,
  "ts-ex-node-cordoned": checkNodeCordoned,
  "ws-ex-rollback": checkRollback,
  "ws-ex-scale-autoscale": checkScaleAutoscale,
  "ws-ex-dedicated-node": checkDedicatedNode,
  "ws-ex-affinity-pending": checkAffinityPending,
};

export function getLiveChecker(exerciseId: string): LiveChecker | undefined {
  return CHECKERS[exerciseId];
}
