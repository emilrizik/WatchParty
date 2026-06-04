import { SeriesDetailClient } from "./_components/series-detail-client";

interface PageProps {
  params: { id: string };
}

export default async function SeriesDetailPage({ params }: PageProps) {
  return <SeriesDetailClient seriesId={params.id} />;
}
