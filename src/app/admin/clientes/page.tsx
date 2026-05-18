import { ClientsManager } from "@/components/clients/clients-manager";
import { AdminShell } from "@/components/layout/admin-shell";

export default function ClientsPage() {
  return (
    <AdminShell>
      <ClientsManager />
    </AdminShell>
  );
}
