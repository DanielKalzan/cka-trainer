import type { DomainId } from "@/lib/constants/domains";
import type { DomainContent, Lesson, QuizQuestion, TerminalExercise } from "@/lib/types/content";
import clusterArchitecture from "@/content/cluster-architecture";
import troubleshooting from "@/content/troubleshooting";
import servicesNetworking from "@/content/services-networking";
import workloadsScheduling from "@/content/workloads-scheduling";
import storage from "@/content/storage";

/**
 * Central content registry. Domains without content yet simply aren't listed;
 * pages render an empty state. Adding a domain = add its /content folder and
 * one line here.
 */
const CONTENT: Partial<Record<DomainId, DomainContent>> = {
  troubleshooting,
  "cluster-architecture": clusterArchitecture,
  "services-networking": servicesNetworking,
  "workloads-scheduling": workloadsScheduling,
  storage,
};

export function getDomainContent(domainId: DomainId): DomainContent | undefined {
  return CONTENT[domainId];
}

export function getLessons(domainId: DomainId): Lesson[] {
  return CONTENT[domainId]?.lessons ?? [];
}

export function getLesson(domainId: DomainId, lessonId: string): Lesson | undefined {
  return getLessons(domainId).find((l) => l.id === lessonId);
}

export function getQuiz(domainId: DomainId): QuizQuestion[] {
  return CONTENT[domainId]?.quiz ?? [];
}

export function getExercises(domainId: DomainId): TerminalExercise[] {
  return CONTENT[domainId]?.exercises ?? [];
}

export function getExercise(
  domainId: DomainId,
  exerciseId: string,
): TerminalExercise | undefined {
  return getExercises(domainId).find((e) => e.id === exerciseId);
}

export function getAllExercises(): TerminalExercise[] {
  return Object.values(CONTENT).flatMap((c) => c.exercises);
}

export function getExerciseById(exerciseId: string): TerminalExercise | undefined {
  return getAllExercises().find((e) => e.id === exerciseId);
}
