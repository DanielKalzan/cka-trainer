import type { DomainContent } from "@/lib/types/content";
import etcdBackupRestore from "./lessons/etcd-backup-restore";
import kubeadmUpgrade from "./lessons/kubeadm-upgrade";
import rbacFast from "./lessons/rbac-fast";
import quiz from "./quiz";
import exercises from "./exercises";

const clusterArchitecture: DomainContent = {
  domainId: "cluster-architecture",
  lessons: [etcdBackupRestore, kubeadmUpgrade, rbacFast],
  quiz,
  exercises,
};

export default clusterArchitecture;
