import type { DomainContent } from "@/lib/types/content";
import podTriage from "./lessons/pod-triage";
import nodeNotReady from "./lessons/node-notready";
import serviceDebug from "./lessons/service-debug";
import quiz from "./quiz";
import exercises from "./exercises";

const troubleshooting: DomainContent = {
  domainId: "troubleshooting",
  lessons: [podTriage, nodeNotReady, serviceDebug],
  quiz,
  exercises,
};

export default troubleshooting;
