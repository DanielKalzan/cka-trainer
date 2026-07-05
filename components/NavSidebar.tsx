"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileQuestion,
  Flame,
  LayoutDashboard,
  Terminal,
  Timer,
  User,
  Zap,
} from "lucide-react";

import { currentStreak } from "@/lib/gamification/streak";
import { levelProgress } from "@/lib/gamification/xp";
import { useProgressStore } from "@/store/useProgressStore";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Terminal },
  { href: "/exam", label: "Mock Exam", icon: Timer },
  { href: "/cheatsheet", label: "Cheatsheet", icon: FileQuestion },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavSidebar() {
  const pathname = usePathname();
  const xp = useProgressStore((s) => s.xp);
  const activityDates = useProgressStore((s) => s.activityDates);
  const { level, ratio } = levelProgress(xp);
  const streak = currentStreak(activityDates);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-edge bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <Terminal className="h-5 w-5 text-term-green" />
        <span className="font-mono text-sm font-semibold tracking-tight">
          cka<span className="text-term-green">-trainer</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-raised text-ink"
                  : "text-muted hover:bg-raised/60 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-edge px-5 py-4 text-sm">
        <div className="flex items-center justify-between">
          <span
            className={`flex items-center gap-1.5 ${streak > 0 ? "text-warning" : "text-faint"}`}
            title={`${streak}-day streak`}
          >
            <Flame className="h-4 w-4" />
            {streak}
          </span>
          <span className="flex items-center gap-1.5 text-accent" title={`${xp} XP`}>
            <Zap className="h-4 w-4" />
            lvl {level}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-raised" title="progress to next level">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
