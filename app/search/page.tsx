import { Suspense } from "react";
import { SearchClient } from "./_components/search-client";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchClient />
    </Suspense>
  );
}
