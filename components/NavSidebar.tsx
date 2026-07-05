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

      {/* Streak + XP — static placeholders until the gamification phase */}
      <div className="flex items-center justify-between border-t border-edge px-5 py-4 text-sm">
        <span className="flex items-center gap-1.5 text-warning">
          <Flame className="h-4 w-4" />0
        </span>
        <span className="flex items-center gap-1.5 text-accent">
          <Zap className="h-4 w-4" />0 XP
        </span>
      </div>
    </aside>
  );
}
