import type { DomainContent } from "@/lib/types/content";
import rollouts from "./lessons/rollouts";
import schedulingControls from "./lessons/scheduling-controls";
import configResourcesHpa from "./lessons/config-resources-hpa";
import quiz from "./quiz";
import exercises from "./exercises";

const workloadsScheduling: DomainContent = {
  domainId: "workloads-scheduling",
  lessons: [rollouts, schedulingControls, configResourcesHpa],
  quiz,
  exercises,
};

export default workloadsScheduling;
