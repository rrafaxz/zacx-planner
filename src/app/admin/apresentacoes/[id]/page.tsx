import { AdminShell } from "@/components/layout/admin-shell";
import { VisualPresentationEditor } from "@/components/visual-presentations/visual-presentation-editor";

type VisualPresentationPageProps = {
  params: {
    id: string;
  };
};

export default function VisualPresentationPage({ params }: VisualPresentationPageProps) {
  return (
    <AdminShell>
      <VisualPresentationEditor presentationId={params.id} />
    </AdminShell>
  );
}
