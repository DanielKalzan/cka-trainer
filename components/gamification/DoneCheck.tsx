"use client";

import { CheckCircle2 } from "lucide-react";
import { useProgressStore } from "@/store/useProgressStore";

interface DoneCheckProps {
  type: "lesson" | "exercise";
  id: string;
}

/** Green check shown on list rows once the lesson/exercise is completed. */
export default function DoneCheck({ type, id }: DoneCheckProps) {
  const done = useProgressStore((s) =>
    type === "lesson" ? Boolean(s.lessonsCompleted[id]) : Boolean(s.exercisesPassed[id]),
  );
  if (!done) return null;
  return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="completed" />;
}
