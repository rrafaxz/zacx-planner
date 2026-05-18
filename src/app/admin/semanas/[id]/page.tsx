import { AdminShell } from "@/components/layout/admin-shell";
import { WeekEditor } from "@/components/planning/week-editor";

type WeekPageProps = {
  params: {
    id: string;
  };
};

export default function WeekPage({ params }: WeekPageProps) {
  return (
    <AdminShell>
      <WeekEditor weekId={params.id} />
    </AdminShell>
  );
}
