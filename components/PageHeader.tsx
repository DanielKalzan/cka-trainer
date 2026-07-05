import type { ReactNode } from "react";
import type { Domain } from "@/lib/constants/domains";
import DomainBadge from "@/components/DomainBadge";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  domain?: Domain;
  children?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  domain,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-8 space-y-2">
      {domain ? <DomainBadge domain={domain} /> : null}
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      {children}
    </header>
  );
}
