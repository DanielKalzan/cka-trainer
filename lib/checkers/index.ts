import type { CheckResult } from "@/lib/types/content";
import { checkPvPvcPod, checkStorageClassClaim } from "./storage";

/**
 * Server-side checker registry, keyed by exercise id. The bridge resolves an
 * exercise's checker here; content files never import this module (it pulls in
 * @kubernetes/client-node, which must stay out of the client bundle).
 */

export type LiveChecker = (namespace: string) => Promise<CheckResult>;

const CHECKERS: Record<string, LiveChecker> = {
  "st-ex-pv-pvc-pod": checkPvPvcPod,
  "st-ex-storageclass": checkStorageClassClaim,
};

export function getLiveChecker(exerciseId: string): LiveChecker | undefined {
  return CHECKERS[exerciseId];
}
