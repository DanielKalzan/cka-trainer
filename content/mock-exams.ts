import type { MockExam } from "@/lib/types/content";

/**
 * Task mix mirrors the real exam's domain weights as closely as 8 tasks allow:
 * Troubleshooting 30% → 2, Cluster Architecture 25% → 2, Networking 20% → 2,
 * Workloads 15% → 1, Storage 10% → 1.
 */
export const MOCK_EXAMS: MockExam[] = [
  {
    id: "mock-a",
    title: "Mock Exam A",
    durationMinutes: 60,
    taskIds: [
      "ts-ex-imagepull",
      "ca-ex-rbac-ci",
      "sn-ex-expose",
      "ws-ex-dedicated-node",
      "ts-ex-taint-pending",
      "ca-ex-etcd-backup-restore",
      "st-ex-pv-pvc-pod",
      "sn-ex-netpol",
    ],
  },
];

export function getMockExam(id: string): MockExam | undefined {
  return MOCK_EXAMS.find((e) => e.id === id);
}
