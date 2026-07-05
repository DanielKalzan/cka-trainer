import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, FileQuestion, Terminal } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { getDomain } from "@/lib/constants/domains";
import { getExercises, getLessons, getQuiz } from "@/lib/content/registry";

interface Props {
  params: { domain: string };
}

export default function DomainPage({ params }: Props) {
  const domain = getDomain(params.domain);
  if (!domain) notFound();

  const lessons = getLessons(domain.id);
  const exercises = getExercises(domain.id);
  const quiz = getQuiz(domain.id);

  return (
    <>
      <PageHeader title={domain.name} subtitle={domain.tagline} domain={domain} />

      {lessons.length === 0 && exercises.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge p-8 text-center text-sm text-muted">
          Content for this domain lands in Phase 5.
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Lessons
            </h2>
            <ol className="space-y-2">
              {lessons.map((lesson, i) => (
                <li key={lesson.id}>
                  <Link
                    href={`/learn/${domain.id}/${lesson.id}`}
                    className="flex items-center gap-4 rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-faint"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm"
                      style={{ backgroundColor: `${domain.color}1a`, color: domain.color }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium">{lesson.title}</span>
                    <span className="flex items-center gap-1.5 text-sm text-muted">
                      <Clock className="h-3.5 w-3.5" />
                      {lesson.estMinutes} min
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Terminal exercises
            </h2>
            <ol className="space-y-2">
              {exercises.map((ex) => (
                <li key={ex.id}>
                  <Link
                    href={`/practice/${domain.id}/${ex.id}`}
                    className="flex items-center gap-4 rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-faint"
                  >
                    <Terminal className="h-4 w-4 shrink-0 text-term-green" />
                    <span className="flex-1 font-medium">{ex.title}</span>
                    <span className="font-mono text-xs text-muted">
                      {ex.difficulty} · {ex.points} pts · ~{Math.round(ex.timeBudgetSeconds / 60)} min
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {quiz.length > 0 ? (
            <Link
              href={`/quiz/${domain.id}`}
              className="flex items-center gap-3 rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-faint"
            >
              <FileQuestion className="h-4 w-4 text-accent" />
              <span className="flex-1 font-medium">Concept quiz</span>
              <span className="font-mono text-xs text-muted">{quiz.length} questions</span>
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}
