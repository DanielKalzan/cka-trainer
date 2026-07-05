import type { DomainContent } from "@/lib/types/content";
import pvPvcLifecycle from "./lessons/pv-pvc-lifecycle";
import storageclassDynamic from "./lessons/storageclass-dynamic";
import quiz from "./quiz";
import exercises from "./exercises";

const storage: DomainContent = {
  domainId: "storage",
  lessons: [pvPvcLifecycle, storageclassDynamic],
  quiz,
  exercises,
};

export default storage;
