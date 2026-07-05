import PageHeader from "@/components/PageHeader";

export default function PracticePage() {
  return (
    <>
      <PageHeader
        title="Practice Sandbox"
        subtitle="Free-form kubectl terminal against a default cluster — lands with the terminal engine (Phase 3)."
      />
      <div className="rounded-xl border border-edge bg-term-bg p-5 font-mono text-sm">
        <span className="text-term-prompt">$ </span>
        <span className="text-muted">kubectl get pods</span>
        <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-term-green align-middle" />
      </div>
    </>
  );
}
