import { notFound } from "next/navigation";
import { Award, Clock } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MarkdownView from "@/components/MarkdownView";
import { getDomain } from "@/lib/constants/domains";
import { getExercise } from "@/lib/content/registry";

interface Props {
  params: { domain: string; exerciseId: string };
}

export default function ExercisePage({ params }: Props) {
  const domain = getDomain(params.domain);
  if (!domain) notFound();
  const exercise = getExercise(domain.id, params.exerciseId);
  if (!exercise) notFound();

  return (
    <>
      <PageHeader title={exercise.title} domain={domain}>
        <div className="flex gap-4 pt-1 font-mono text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />~{Math.round(exercise.timeBudgetSeconds / 60)} min
            budget
          </span>
          <span className="flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" />
            {exercise.points} pts · {exercise.difficulty}
          </span>
        </div>
      </PageHeader>

      <section className="mb-6 rounded-xl border border-edge bg-surface p-5 text-sm">
        <MarkdownView>{exercise.scenario}</MarkdownView>
      </section>

      <div className="rounded-xl border border-edge bg-term-bg p-5 font-mono text-sm text-muted">
        Terminal engine lands in Phase 3 — this exercise becomes playable then.
      </div>
    </>
  );
}
