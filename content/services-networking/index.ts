import type { DomainContent } from "@/lib/types/content";
import servicesFast from "./lessons/services-fast";
import networkPolicies from "./lessons/network-policies";
import dnsIngressGateway from "./lessons/dns-ingress-gateway";
import quiz from "./quiz";
import exercises from "./exercises";

const servicesNetworking: DomainContent = {
  domainId: "services-networking",
  lessons: [servicesFast, networkPolicies, dnsIngressGateway],
  quiz,
  exercises,
};

export default servicesNetworking;
