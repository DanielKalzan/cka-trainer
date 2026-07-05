"use client";

import { CheckCircle2 } from "lucide-react";
import { XP_PER_LESSON } from "@/lib/gamification/xp";
import { useProgressStore } from "@/store/useProgressStore";

export default function MarkLessonCompleteButton({ lessonId }: { lessonId: string }) {
  const done = useProgressStore((s) => Boolean(s.lessonsCompleted[lessonId]));
  const completeLesson = useProgressStore((s) => s.completeLesson);

  if (done) {
    return (
      <div className="mt-8 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" />
        Lesson completed
      </div>
    );
  }

  return (
    <button
      onClick={() => completeLesson(lessonId)}
      className="mt-8 flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
    >
      <CheckCircle2 className="h-4 w-4" />
      Mark complete · +{XP_PER_LESSON} XP
    </button>
  );
}
