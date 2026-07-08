import PageHeader from "@/components/PageHeader";
import ExamResults from "@/components/exam/ExamResults";

interface Props {
  params: Promise<{ attemptId: string }>;
}

export default async function ExamResultsPage({ params }: Props) {
  const { attemptId } = await params;
  return (
    <>
      <PageHeader
        title="Exam Results"
        subtitle="Points-weighted, graded like the real thing."
        breadcrumbs={[{ label: "Mock Exam", href: "/exam" }, { label: "Results" }]}
      />
      <ExamResults attemptId={attemptId} />
    </>
  );
}
