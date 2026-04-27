import { Suspense } from "react";
import { EpisodeWatchClient } from "./_components/episode-watch-client";

export const dynamic = "force-dynamic";

export default async function EpisodeWatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <EpisodeWatchClient episodeId={id} />
    </Suspense>
  );
}
