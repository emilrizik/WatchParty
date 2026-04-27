import { WatchClient } from "./_components/watch-client";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WatchClient videoId={id} />;
}
