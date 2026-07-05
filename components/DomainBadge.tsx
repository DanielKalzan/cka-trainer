import type { Domain } from "@/lib/constants/domains";

interface DomainBadgeProps {
  domain: Domain;
  size?: "sm" | "md";
}

export default function DomainBadge({ domain, size = "sm" }: DomainBadgeProps) {
  const Icon = domain.icon;
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${pad}`}
      style={{
        color: domain.color,
        borderColor: `${domain.color}55`,
        backgroundColor: `${domain.color}14`,
      }}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {domain.shortName}
    </span>
  );
}
