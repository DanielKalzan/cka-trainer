import PageHeader from "@/components/PageHeader";
import ExamHome from "@/components/exam/ExamHome";

export default function ExamPage() {
  return (
    <>
      <PageHeader
        title="Mock Exam"
        subtitle="Timed, weighted like the real thing, graded only at the end."
      />
      <ExamHome />
    </>
  );
}
