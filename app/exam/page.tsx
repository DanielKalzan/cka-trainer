import PageHeader from "@/components/PageHeader";
import { EXAM_DURATION_MINUTES, PASS_THRESHOLD } from "@/lib/constants/domains";

export default function ExamPage() {
  return (
    <PageHeader
      title="Mock Exam"
      subtitle={`${EXAM_DURATION_MINUTES}-minute timed exam, tasks weighted like the real thing, ${PASS_THRESHOLD}% to pass — lands in Phase 6.`}
    />
  );
}
