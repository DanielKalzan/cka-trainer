import type { ParsedCommand } from "../parser";
import { err, ok, type ExecResult } from "./helpers";

const EXPLANATIONS: Record<string, string> = {
  pods: `KIND:       Pod
VERSION:    v1

DESCRIPTION:
     Pod is a collection of containers that can run on a host.

FIELDS:
   apiVersion   <string>
   kind         <string>
   metadata     <ObjectMeta>
   spec         <PodSpec>
     containers         <[]Container> -required-
     initContainers     <[]Container>
     nodeName           <string>
     nodeSelector       <map[string]string>
     serviceAccountName <string>
     tolerations        <[]Toleration>
     volumes            <[]Volume>
   status       <PodStatus>`,
  deployments: `KIND:       Deployment
VERSION:    apps/v1

DESCRIPTION:
     Deployment enables declarative updates for Pods and ReplicaSets.

FIELDS:
   spec         <DeploymentSpec>
     replicas   <integer>
     selector   <LabelSelector> -required-
     strategy   <DeploymentStrategy>
     template   <PodTemplateSpec> -required-`,
  services: `KIND:       Service
VERSION:    v1

DESCRIPTION:
     Service is a named abstraction of an application running on a set of
     pods, exposed via a virtual IP.

FIELDS:
   spec         <ServiceSpec>
     type       <string>  ClusterIP | NodePort | LoadBalancer | ExternalName
     selector   <map[string]string>
     ports      <[]ServicePort>
       port       <integer> -required-
       targetPort <IntOrString>
       nodePort   <integer>`,
  persistentvolumes: `KIND:       PersistentVolume
VERSION:    v1

FIELDS:
   spec         <PersistentVolumeSpec>
     accessModes                   <[]string>
     capacity                      <map[string]Quantity>
     persistentVolumeReclaimPolicy <string>
     storageClassName              <string>
     hostPath / nfs / csi          <VolumeSource>`,
  persistentvolumeclaims: `KIND:       PersistentVolumeClaim
VERSION:    v1

FIELDS:
   spec         <PersistentVolumeClaimSpec>
     accessModes      <[]string>
     resources        <ResourceRequirements>
       requests.storage <Quantity>
     storageClassName <string>
     volumeName       <string>`,
  networkpolicies: `KIND:       NetworkPolicy
VERSION:    networking.k8s.io/v1

FIELDS:
   spec         <NetworkPolicySpec>
     podSelector <LabelSelector> -required-
     policyTypes <[]string>  Ingress | Egress
     ingress     <[]NetworkPolicyIngressRule>
     egress      <[]NetworkPolicyEgressRule>`,
  nodes: `KIND:       Node
VERSION:    v1

FIELDS:
   spec         <NodeSpec>
     taints        <[]Taint>
     unschedulable <boolean>
   status       <NodeStatus>`,
};

const ALIAS: Record<string, string> = {
  po: "pods", pod: "pods", pods: "pods",
  deploy: "deployments", deployment: "deployments", deployments: "deployments",
  svc: "services", service: "services", services: "services",
  pv: "persistentvolumes", persistentvolume: "persistentvolumes", persistentvolumes: "persistentvolumes",
  pvc: "persistentvolumeclaims", persistentvolumeclaim: "persistentvolumeclaims", persistentvolumeclaims: "persistentvolumeclaims",
  netpol: "networkpolicies", networkpolicy: "networkpolicies", networkpolicies: "networkpolicies",
  no: "nodes", node: "nodes", nodes: "nodes",
};

export function handleExplain(cmd: ParsedCommand): ExecResult {
  const target = cmd.args[0];
  if (!target) return err("error: you must specify the type of resource to explain");
  const root = target.split(".")[0].toLowerCase();
  const key = ALIAS[root];
  if (!key) return err(`error: couldn't find resource for "${root}" (simulator has help for: pods, deployments, services, pv, pvc, netpol, nodes)`);
  return ok(EXPLANATIONS[key]);
}
