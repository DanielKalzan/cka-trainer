import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DOMAINS } from "@/lib/constants/domains";

export default function LearnPage() {
  return (
    <>
      <PageHeader
        title="Learning Path"
        subtitle="Five domains, weighted like the real exam. Start anywhere."
      />
      <ol className="space-y-3">
        {DOMAINS.map((domain) => {
          const Icon = domain.icon;
          return (
            <li key={domain.id}>
              <Link
                href={`/learn/${domain.id}`}
                className="flex items-center gap-4 rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-faint"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${domain.color}1a`, color: domain.color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{domain.name}</div>
                  <div className="truncate text-sm text-muted">{domain.tagline}</div>
                </div>
                <span className="font-mono text-sm text-muted">
                  {Math.round(domain.weight * 100)}%
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
