import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { SearchClient } from "./_components/search-client";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  return <SearchClient />;
}
