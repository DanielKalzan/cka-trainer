import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getDomain } from "@/lib/constants/domains";

interface Props {
  params: { domain: string; exerciseId: string };
}

export default function ExercisePage({ params }: Props) {
  const domain = getDomain(params.domain);
  if (!domain) notFound();

  return (
    <PageHeader
      title={`Exercise: ${params.exerciseId}`}
      subtitle="Scripted terminal exercise renders here once the terminal engine lands (Phase 3)."
      domain={domain}
    />
  );
}
