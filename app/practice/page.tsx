import Link from "next/link";
import { Terminal as TerminalIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import DomainBadge from "@/components/DomainBadge";
import DoneCheck from "@/components/gamification/DoneCheck";
import SandboxTerminal from "@/components/terminal/SandboxTerminal";
import { DOMAINS } from "@/lib/constants/domains";
import { getExercises } from "@/lib/content/registry";

export default function PracticePage() {
  return (
    <>
      <PageHeader
        title="Practice Sandbox"
        subtitle="Free-form kubectl terminal against a real local kind cluster. No grading, no stakes."
      />
      <SandboxTerminal />

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Scripted exercises
        </h2>
        <div className="space-y-6">
          {DOMAINS.map((domain) => {
            const exercises = getExercises(domain.id);
            if (exercises.length === 0) return null;
            return (
              <div key={domain.id}>
                <DomainBadge domain={domain} />
                <ol className="mt-3 space-y-2">
                  {exercises.map((ex) => (
                    <li key={ex.id}>
                      <Link
                        href={`/practice/${domain.id}/${ex.id}`}
                        className="flex items-center gap-4 rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-faint"
                      >
                        <TerminalIcon className="h-4 w-4 shrink-0 text-term-green" />
                        <span className="flex-1 font-medium">{ex.title}</span>
                        <DoneCheck type="exercise" id={ex.id} />
                        <span className="font-mono text-xs text-muted">
                          {ex.difficulty} · {ex.points} pts
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
