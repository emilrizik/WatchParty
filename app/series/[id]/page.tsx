import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SeriesDetailClient } from "./_components/series-detail-client";

interface PageProps {
  params: { id: string };
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login");
  }

  return <SeriesDetailClient seriesId={params.id} />;
}
