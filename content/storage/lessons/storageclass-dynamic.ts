import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "st-storageclass-dynamic",
  domainId: "storage",
  title: "StorageClasses and dynamic provisioning",
  estMinutes: 8,
  body: `
Static provisioning (admin pre-creates PVs) is the exam's YAML drill; **dynamic provisioning** is how real clusters work: a PVC names a StorageClass, and the class's provisioner creates a fitting PV on demand.

\`\`\`yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-local
provisioner: kubernetes.io/no-provisioner   # or a CSI driver, e.g. ebs.csi.aws.com
reclaimPolicy: Delete                        # default for dynamic PVs
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
\`\`\`

No \`spec\` block — \`provisioner\`, \`reclaimPolicy\`, \`volumeBindingMode\` sit at top level. That trips up people who reflexively type \`spec:\`.

## volumeBindingMode — the field exam questions orbit

- \`Immediate\` (default) — PV created/bound the moment the PVC appears. Risk: the volume lands in a zone where the pod later can't schedule.
- \`WaitForFirstConsumer\` — binding waits until a pod uses the PVC, so volume placement follows pod placement. **A PVC sitting in Pending with \`WaitForFirstConsumer\` and no pod is healthy, not broken** — the exam loves this fake symptom.

\`kubernetes.io/no-provisioner\` means no dynamic creation (used with local volumes) — PVs must still be made by hand; the class then only handles delayed binding.

## Defaulting

A PVC with **no** \`storageClassName\` gets the cluster's default class (the one annotated \`storageclass.kubernetes.io/is-default-class: "true"\` — shown as \`(default)\` in \`kubectl get sc\`).

A PVC with \`storageClassName: ""\` explicitly opts OUT of dynamic provisioning and only binds pre-existing class-less PVs. Empty string ≠ unset — worth repeating.

## Expansion

Only if the class has \`allowVolumeExpansion: true\`: edit the PVC's \`resources.requests.storage\` upward (never downward — shrinking is invalid). The filesystem grows when the pod restarts or online, driver depending.
`,
  tips: [
    {
      type: "exam-tip",
      text: "PVC Pending + class uses WaitForFirstConsumer + no pod references it yet = working as designed. Create the pod, then re-check. Don't 'fix' it.",
    },
    {
      type: "exam-tip",
      text: "StorageClass has no spec: — provisioner/reclaimPolicy/volumeBindingMode are top-level fields. kubectl explain storageclass confirms in-exam.",
    },
    {
      type: "deep-dive",
      text: "Changing a StorageClass's reclaimPolicy doesn't touch existing PVs — each PV copied the policy at creation. Retroactive changes mean editing individual PVs.",
    },
    {
      type: "deep-dive",
      text: "CSI drivers replaced in-tree provisioners (kubernetes.io/aws-ebs → ebs.csi.aws.com). On modern clusters every real provisioner string is a CSI driver name.",
    },
  ],
};

export default lesson;
