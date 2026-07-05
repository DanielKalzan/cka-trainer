import PageHeader from "@/components/PageHeader";
import Dashboard from "@/components/gamification/Dashboard";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Where you stand against the real exam, today." />
      <Dashboard />
    </>
  );
}
