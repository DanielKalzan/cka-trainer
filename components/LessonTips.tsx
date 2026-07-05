import { Lightbulb, Microscope } from "lucide-react";
import type { LessonTip } from "@/lib/types/content";

export default function LessonTips({ tips }: { tips: LessonTip[] }) {
  const examTips = tips.filter((t) => t.type === "exam-tip");
  const deepDives = tips.filter((t) => t.type === "deep-dive");

  return (
    <div className="mt-8 space-y-3">
      {examTips.map((tip, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm"
        >
          <Lightbulb className="h-4 w-4 shrink-0 text-warning" />
          <p className="leading-relaxed text-ink/90">{tip.text}</p>
        </div>
      ))}
      {deepDives.map((tip, i) => (
        <details
          key={i}
          className="group rounded-lg border border-edge bg-surface p-4 text-sm"
        >
          <summary className="flex cursor-pointer items-center gap-2 text-muted transition-colors hover:text-ink">
            <Microscope className="h-4 w-4 shrink-0" />
            Deep dive — nice to know, not required
          </summary>
          <p className="mt-3 leading-relaxed text-ink/90">{tip.text}</p>
        </details>
      ))}
    </div>
  );
}
