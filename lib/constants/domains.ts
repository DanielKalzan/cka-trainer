import {
  HardDrive,
  Layers,
  Network,
  Server,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for CKA exam domains (CKA v1.35, CNCF).
 * Every readiness/score calculation must read weights from here.
 */

export type DomainId =
  | "troubleshooting"
  | "cluster-architecture"
  | "services-networking"
  | "workloads-scheduling"
  | "storage";

export interface Domain {
  /** Also used as the URL slug. */
  id: DomainId;
  name: string;
  shortName: string;
  /** Fraction of the exam; all weights sum to 1. */
  weight: number;
  /** Accent color for text/icons on dark surfaces. */
  color: string;
  /** Chart-mark color — palette validated (lightness band, CVD, contrast) for the dark chart surface. */
  chartColor: string;
  icon: LucideIcon;
  tagline: string;
}

export const DOMAINS: readonly Domain[] = [
  {
    id: "troubleshooting",
    name: "Troubleshooting",
    shortName: "Troubleshooting",
    weight: 0.3,
    color: "#f87171",
    chartColor: "#ef4444",
    icon: Wrench,
    tagline: "Broken pods, dead nodes, silent services — find it fast.",
  },
  {
    id: "cluster-architecture",
    name: "Cluster Architecture, Installation & Configuration",
    shortName: "Cluster Architecture",
    weight: 0.25,
    color: "#a78bfa",
    chartColor: "#8b5cf6",
    icon: Server,
    tagline: "Control plane, kubeadm, etcd backup/restore, RBAC.",
  },
  {
    id: "services-networking",
    name: "Services & Networking",
    shortName: "Services & Networking",
    weight: 0.2,
    color: "#22d3ee",
    chartColor: "#0891b2",
    icon: Network,
    tagline: "Services, Ingress, NetworkPolicies, DNS.",
  },
  {
    id: "workloads-scheduling",
    name: "Workloads & Scheduling",
    shortName: "Workloads & Scheduling",
    weight: 0.15,
    color: "#4ade80",
    chartColor: "#16a34a",
    icon: Layers,
    tagline: "Deployments, rollouts, taints, affinity, autoscaling.",
  },
  {
    id: "storage",
    name: "Storage",
    shortName: "Storage",
    weight: 0.1,
    color: "#fbbf24",
    chartColor: "#d97706",
    icon: HardDrive,
    tagline: "PVs, PVCs, StorageClasses, access modes.",
  },
] as const;

/** Exam pass threshold, percent. */
export const PASS_THRESHOLD = 66;

/** Real exam duration, minutes. */
export const EXAM_DURATION_MINUTES = 120;

export function getDomain(id: string): Domain | undefined {
  return DOMAINS.find((d) => d.id === id);
}

export function isDomainId(id: string): id is DomainId {
  return DOMAINS.some((d) => d.id === id);
}
