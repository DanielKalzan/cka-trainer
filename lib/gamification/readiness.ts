import { DOMAINS, type Domain, type DomainId } from "@/lib/constants/domains";
import { getDomainContent } from "@/lib/content/registry";
import type { ProgressData } from "./types";

/**
 * Readiness math. Domain score blends the three activity types; the overall
 * score weights domains by the real exam weights from lib/constants/domains —
 * never hardcode those numbers here.
 */

const LESSON_SHARE = 0.2;
const QUIZ_SHARE = 0.3;
const EXERCISE_SHARE = 0.5;

export interface DomainReadiness {
  domain: Domain;
  /** 0–100 */
  score: number;
  lessonsDone: number;
  lessonsTotal: number;
  quizBestPct: number | null;
  exercisesDone: number;
  exercisesTotal: number;
  hasContent: boolean;
}

export function domainReadiness(p: ProgressData, domainId: DomainId): DomainReadiness {
  const domain = DOMAINS.find((d) => d.id === domainId)!;
  const content = getDomainContent(domainId);
  if (!content || (content.lessons.length === 0 && content.exercises.length === 0)) {
    return {
      domain,
      score: 0,
      lessonsDone: 0,
      lessonsTotal: 0,
      quizBestPct: null,
      exercisesDone: 0,
      exercisesTotal: 0,
      hasContent: false,
    };
  }

  const lessonsTotal = content.lessons.length;
  const lessonsDone = content.lessons.filter((l) => p.lessonsCompleted[l.id]).length;
  const exercisesTotal = content.exercises.length;
  const exercisesDone = content.exercises.filter((e) => p.exercisesPassed[e.id]).length;
  const quizBest = p.quizBest[domainId];

  // Renormalize shares when a domain lacks an activity type
  let score = 0;
  let shareSum = 0;
  if (lessonsTotal > 0) {
    score += LESSON_SHARE * (lessonsDone / lessonsTotal);
    shareSum += LESSON_SHARE;
  }
  if (content.quiz.length > 0) {
    score += QUIZ_SHARE * ((quizBest?.pct ?? 0) / 100);
    shareSum += QUIZ_SHARE;
  }
  if (exercisesTotal > 0) {
    score += EXERCISE_SHARE * (exercisesDone / exercisesTotal);
    shareSum += EXERCISE_SHARE;
  }

  return {
    domain,
    score: shareSum > 0 ? Math.round((score / shareSum) * 100) : 0,
    lessonsDone,
    lessonsTotal,
    quizBestPct: quizBest?.pct ?? null,
    exercisesDone,
    exercisesTotal,
    hasContent: true,
  };
}

export function allDomainReadiness(p: ProgressData): DomainReadiness[] {
  return DOMAINS.map((d) => domainReadiness(p, d.id));
}

/** Weighted overall readiness, 0–100 — "if you sat the exam today". */
export function overallReadiness(p: ProgressData): number {
  return Math.round(
    DOMAINS.reduce((sum, d) => sum + d.weight * domainReadiness(p, d.id).score, 0),
  );
}

export interface Recommendation {
  href: string;
  title: string;
  reason: string;
  domain: Domain;
}

/** Weakest weighted domain first, then: unfinished lesson → unpassed exercise → imperfect quiz. */
export function recommendedNext(p: ProgressData): Recommendation | null {
  const ranked = allDomainReadiness(p)
    .filter((r) => r.hasContent)
    .sort((a, b) => b.domain.weight * (100 - b.score) - a.domain.weight * (100 - a.score));

  for (const r of ranked) {
    const content = getDomainContent(r.domain.id)!;
    const lesson = content.lessons.find((l) => !p.lessonsCompleted[l.id]);
    if (lesson) {
      return {
        href: `/learn/${r.domain.id}/${lesson.id}`,
        title: lesson.title,
        reason: `${r.domain.shortName} is ${Math.round(r.domain.weight * 100)}% of the exam and your score there is ${r.score}%.`,
        domain: r.domain,
      };
    }
    const exercise = content.exercises.find((e) => !p.exercisesPassed[e.id]);
    if (exercise) {
      return {
        href: `/practice/${r.domain.id}/${exercise.id}`,
        title: exercise.title,
        reason: `Hands-on tasks carry the most readiness weight in ${r.domain.shortName}.`,
        domain: r.domain,
      };
    }
    if (content.quiz.length > 0 && (p.quizBest[r.domain.id]?.pct ?? 0) < 100) {
      return {
        href: `/quiz/${r.domain.id}`,
        title: `${r.domain.shortName} quiz — beat ${p.quizBest[r.domain.id]?.pct ?? 0}%`,
        reason: "Everything else in this domain is done.",
        domain: r.domain,
      };
    }
  }
  return null;
}
