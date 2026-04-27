"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { VideoCard } from "@/components/video-card";
import { Loader2, Search, Film } from "lucide-react";

interface Video {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | null;
  category?: {
    id: string;
    name: string;
  } | null;
}

export function SearchClient() {
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") ?? "";
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query) {
      fetchSearchResults();
    }
  }, [query]);

  const fetchSearchResults = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/videos/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        throw new Error("Error al buscar");
      }

      const data = await res.json();
      setVideos(data);
    } catch (err: any) {
      console.error("Search error:", err);
      setError(err?.message ?? "Error al buscar videos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Resultados para: <span className="text-primary">"{query}"</span>
          </h1>
          {!loading && (
            <p className="text-muted-foreground">
              {videos?.length ?? 0} video{videos?.length !== 1 ? "s" : ""} encontrado{videos?.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-6 text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {videos?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    id={video.id}
                    title={video.title}
                    thumbnailUrl={video.thumbnailUrl}
                    duration={video.duration}
                    category={video.category}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Search className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2">
                  No se encontraron resultados
                </h2>
                <p className="text-muted-foreground">
                  Intenta con otras palabras clave
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
