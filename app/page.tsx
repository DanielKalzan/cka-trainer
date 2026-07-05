import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import DomainBadge from "@/components/DomainBadge";
import { DOMAINS, PASS_THRESHOLD } from "@/lib/constants/domains";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Exam readiness, streak and recommended next steps land here. Pass bar: ${PASS_THRESHOLD}%.`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {DOMAINS.map((domain) => (
          <Link
            key={domain.id}
            href={`/learn/${domain.id}`}
            className="rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-faint"
          >
            <div className="flex items-center justify-between">
              <DomainBadge domain={domain} />
              <span className="font-mono text-sm text-muted">
                {Math.round(domain.weight * 100)}%
              </span>
            </div>
            <p className="mt-3 text-sm text-muted">{domain.tagline}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
