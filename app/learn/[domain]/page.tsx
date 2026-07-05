import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getDomain } from "@/lib/constants/domains";

interface Props {
  params: { domain: string };
}

export default function DomainPage({ params }: Props) {
  const domain = getDomain(params.domain);
  if (!domain) notFound();

  return (
    <>
      <PageHeader
        title={domain.name}
        subtitle="Lessons for this domain appear here once content lands (Phase 2)."
        domain={domain}
      />
      <div className="flex gap-3 text-sm">
        <Link
          href={`/quiz/${domain.id}`}
          className="rounded-lg border border-edge bg-surface px-4 py-2 text-muted transition-colors hover:text-ink"
        >
          Quiz
        </Link>
        <Link
          href="/practice"
          className="rounded-lg border border-edge bg-surface px-4 py-2 text-muted transition-colors hover:text-ink"
        >
          Terminal exercises
        </Link>
      </div>
    </>
  );
}
