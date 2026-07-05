"use client";

import Link from "next/link";
import { ArrowRight, Award, Flame } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { PASS_THRESHOLD } from "@/lib/constants/domains";
import { BADGES } from "@/lib/gamification/badges";
import {
  allDomainReadiness,
  overallReadiness,
  recommendedNext,
} from "@/lib/gamification/readiness";
import { currentStreak, recentActivity } from "@/lib/gamification/streak";
import { useProgressStore } from "@/store/useProgressStore";
import DomainBadge from "@/components/DomainBadge";

export default function Dashboard() {
  const progress = useProgressStore();
  const readiness = overallReadiness(progress);
  const perDomain = allDomainReadiness(progress);
  const streak = currentStreak(progress.activityDates);
  const days = recentActivity(progress.activityDates, 14);
  const next = recommendedNext(progress);
  const earnedBadges = BADGES.filter((b) => progress.badges[b.id]).sort(
    (a, b) => (progress.badges[b.id] < progress.badges[a.id] ? -1 : 1),
  );

  const radarData = perDomain.map((r) => ({
    domain: r.domain.shortName.replace(" & ", " & "),
    score: r.score,
  }));

  const passed = readiness >= PASS_THRESHOLD;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Readiness hero */}
      <section className="rounded-xl border border-edge bg-surface p-6 lg:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Exam readiness
        </h2>
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className={`font-mono text-5xl font-bold ${passed ? "text-success" : "text-ink"}`}
          >
            {readiness}%
          </span>
          <span className="text-sm text-muted">need {PASS_THRESHOLD}%</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          {passed
            ? "If you sat the exam today, you'd clear the bar. Keep the edge sharp."
            : `If you sat the exam today: ${readiness}%. ${PASS_THRESHOLD - readiness} points below the pass line.`}
        </p>
        {/* Pass-line bar */}
        <div className="relative mt-4 h-2 rounded-full bg-raised">
          <div
            className={`h-full rounded-full ${passed ? "bg-success" : "bg-accent"}`}
            style={{ width: `${readiness}%` }}
          />
          <div
            className="absolute -top-1 h-4 w-0.5 bg-warning"
            style={{ left: `${PASS_THRESHOLD}%` }}
            title={`${PASS_THRESHOLD}% pass threshold`}
          />
        </div>

        {/* Streak */}
        <div className="mt-6 flex items-center justify-between">
          <span
            className={`flex items-center gap-2 font-mono text-sm ${
              streak > 0 ? "text-warning" : "text-faint"
            }`}
          >
            <Flame className="h-4 w-4" />
            {streak}-day streak
          </span>
          <span className="flex gap-1" aria-label="last 14 days of activity">
            {days.map((d) => (
              <span
                key={d.key}
                title={d.key}
                className={`h-2 w-2 rounded-full ${d.active ? "bg-warning" : "bg-raised"}`}
              />
            ))}
          </span>
        </div>
      </section>

      {/* Radar */}
      <section className="rounded-xl border border-edge bg-surface p-6 lg:col-span-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Readiness by domain
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke="#232c37" />
              <PolarAngleAxis
                dataKey="domain"
                tick={{ fill: "#8b98a5", fontSize: 11 }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                dataKey="score"
                stroke="#4f8ff7"
                strokeWidth={2}
                fill="#4f8ff7"
                fillOpacity={0.25}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recommended next */}
      {next ? (
        <section className="rounded-xl border border-edge bg-surface p-6 lg:col-span-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recommended next
          </h2>
          <Link href={next.href} className="group mt-3 block">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DomainBadge domain={next.domain} />
                <div className="mt-2 font-medium group-hover:text-accent">{next.title}</div>
                <p className="mt-1 text-sm text-muted">{next.reason}</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" />
            </div>
          </Link>
        </section>
      ) : null}

      {/* Badges */}
      <section className="rounded-xl border border-edge bg-surface p-6 lg:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Recent badges
        </h2>
        {earnedBadges.length === 0 ? (
          <p className="mt-3 text-sm text-faint">
            None yet — pass an exercise or finish a lesson.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {earnedBadges.slice(0, 4).map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{b.name}</span>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/profile"
          className="mt-4 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <Award className="h-3.5 w-3.5" />
          all badges
        </Link>
      </section>

      {/* Per-domain bars */}
      <section className="rounded-xl border border-edge bg-surface p-6 lg:col-span-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Domains
        </h2>
        <div className="space-y-4">
          {perDomain.map((r) => (
            <Link key={r.domain.id} href={`/learn/${r.domain.id}`} className="group block">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-medium group-hover:text-accent">
                    {r.domain.shortName}
                  </span>
                  <span className="font-mono text-xs text-faint">
                    {Math.round(r.domain.weight * 100)}% of exam
                  </span>
                </span>
                <span className="font-mono text-xs text-muted">
                  {r.hasContent
                    ? `${r.score}% · ${r.lessonsDone}/${r.lessonsTotal} lessons · ${r.exercisesDone}/${r.exercisesTotal} exercises`
                    : "no content yet"}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-raised">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${r.score}%`, backgroundColor: r.domain.chartColor }}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
