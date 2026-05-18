import { PublicPlanningView } from "@/components/public-view/public-planning-view";

type PublicPageProps = {
  params: {
    slug: string;
  };
};

export default function PublicPage({ params }: PublicPageProps) {
  return <PublicPlanningView slug={params.slug} />;
}
