import { AdminShell } from "@/components/layout/admin-shell";
import { AdminDashboard } from "@/components/planning/admin-dashboard";

export default function AdminPage() {
  return (
    <AdminShell>
      <AdminDashboard />
    </AdminShell>
  );
}
