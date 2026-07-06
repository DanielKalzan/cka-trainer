import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import QuizRunner from "@/components/QuizRunner";
import { getDomain } from "@/lib/constants/domains";
import { getQuiz } from "@/lib/content/registry";

interface Props {
  params: { domain: string };
}

export default function QuizPage({ params }: Props) {
  const domain = getDomain(params.domain);
  if (!domain) notFound();
  const questions = getQuiz(domain.id);

  return (
    <>
      <PageHeader
        title={`${domain.shortName} Quiz`}
        subtitle="Concept checks — the hands-on version lives in the terminal exercises."
        domain={domain}
        breadcrumbs={[
          { label: "Learn", href: "/learn" },
          { label: domain.shortName, href: `/learn/${domain.id}` },
          { label: "Quiz" },
        ]}
      />
      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge p-8 text-center text-sm text-muted">
          Quiz for this domain lands in Phase 5.
        </div>
      ) : (
        <QuizRunner key={domain.id} questions={questions} />
      )}
    </>
  );
}
