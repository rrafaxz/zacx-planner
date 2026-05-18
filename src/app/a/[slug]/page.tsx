import { PublicVisualPresentationView } from "@/components/visual-presentations/public-visual-presentation-view";

type PublicVisualPresentationPageProps = {
  params: {
    slug: string;
  };
};

export default function PublicVisualPresentationPage({ params }: PublicVisualPresentationPageProps) {
  return <PublicVisualPresentationView slug={params.slug} />;
}
