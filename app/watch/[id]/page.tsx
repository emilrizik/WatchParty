import { Suspense } from "react";
import { WatchClient } from "./_components/watch-client";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <WatchClient videoId={id} />
    </Suspense>
  );
}
