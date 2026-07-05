import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getDomain } from "@/lib/constants/domains";

interface Props {
  params: { domain: string; lessonId: string };
}

export default function LessonPage({ params }: Props) {
  const domain = getDomain(params.domain);
  if (!domain) notFound();

  return (
    <PageHeader
      title={`Lesson: ${params.lessonId}`}
      subtitle="Lesson content renders here once the content model lands (Phase 2)."
      domain={domain}
    />
  );
}
