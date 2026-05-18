import { PublicCopyPlanningView } from "@/components/copy-plannings/public-copy-planning-view";

type PublicCopyPlanningPageProps = {
  params: {
    slug: string;
  };
};

export default function PublicCopyPlanningPage({ params }: PublicCopyPlanningPageProps) {
  return <PublicCopyPlanningView slug={params.slug} />;
}
