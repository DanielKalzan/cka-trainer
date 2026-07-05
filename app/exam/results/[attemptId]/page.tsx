import PageHeader from "@/components/PageHeader";
import ExamResults from "@/components/exam/ExamResults";

interface Props {
  params: { attemptId: string };
}

export default function ExamResultsPage({ params }: Props) {
  return (
    <>
      <PageHeader title="Exam Results" subtitle="Points-weighted, graded like the real thing." />
      <ExamResults attemptId={params.attemptId} />
    </>
  );
}
