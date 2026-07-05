import PageHeader from "@/components/PageHeader";

interface Props {
  params: { attemptId: string };
}

export default function ExamResultsPage({ params }: Props) {
  return (
    <PageHeader
      title={`Exam Results: ${params.attemptId}`}
      subtitle="Per-domain score breakdown vs. the 66% bar — lands in Phase 6."
    />
  );
}
