import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ExerciseRunner from "@/components/terminal/ExerciseRunner";
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
      <PageHeader
        title={exercise.title}
        domain={domain}
        breadcrumbs={[
          { label: "Practice", href: "/practice" },
          { label: domain.shortName, href: `/learn/${domain.id}` },
          { label: exercise.title },
        ]}
      />
      <ExerciseRunner domainId={domain.id} exerciseId={exercise.id} />
    </>
  );
}
