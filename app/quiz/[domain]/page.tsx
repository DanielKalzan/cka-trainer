import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getDomain } from "@/lib/constants/domains";

interface Props {
  params: { domain: string };
}

export default function QuizPage({ params }: Props) {
  const domain = getDomain(params.domain);
  if (!domain) notFound();

  return (
    <PageHeader
      title={`${domain.shortName} Quiz`}
      subtitle="Conceptual quiz for this domain — lands with content (Phase 2)."
      domain={domain}
    />
  );
}
