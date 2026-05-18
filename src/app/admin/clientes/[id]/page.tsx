import { ClientDetail } from "@/components/clients/client-detail";
import { AdminShell } from "@/components/layout/admin-shell";

type ClientDetailPageProps = {
  params: {
    id: string;
  };
};

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
  return (
    <AdminShell>
      <ClientDetail clientId={params.id} />
    </AdminShell>
  );
}
