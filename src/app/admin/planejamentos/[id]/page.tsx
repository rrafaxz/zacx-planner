import { CopyPlanningEditor } from "@/components/copy-plannings/copy-planning-editor";
import { AdminShell } from "@/components/layout/admin-shell";

type CopyPlanningPageProps = {
  params: {
    id: string;
  };
};

export default function CopyPlanningPage({ params }: CopyPlanningPageProps) {
  return (
    <AdminShell>
      <CopyPlanningEditor planningId={params.id} />
    </AdminShell>
  );
}
