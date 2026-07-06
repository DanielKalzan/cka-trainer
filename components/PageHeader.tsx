import type { ReactNode } from "react";
import type { Domain } from "@/lib/constants/domains";
import DomainBadge from "@/components/DomainBadge";
import Breadcrumb, { type Crumb } from "@/components/Breadcrumb";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  domain?: Domain;
  breadcrumbs?: Crumb[];
  children?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  domain,
  breadcrumbs,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-8 space-y-2">
      {breadcrumbs ? <Breadcrumb items={breadcrumbs} /> : null}
      {domain ? <DomainBadge domain={domain} /> : null}
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      {children}
    </header>
  );
}
