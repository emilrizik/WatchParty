"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  Tv,
  Play,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Episode {
  id: string;
  number: number;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  videoUrl: string;
  hlsPath?: string | null;
  hlsStatus: string;
  duration?: number | null;
}

interface Season {
  id: string;
  number: number;
  title?: string | null;
  episodes: Episode[];
}

interface Series {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  category?: {
    name: string;
  } | null;
  seasons: Season[];
}

interface SeriesDetailClientProps {
  seriesId: string;
}

export function SeriesDetailClient({ seriesId }: SeriesDetailClientProps) {
  const router = useRouter();
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSeries();
  }, [seriesId]);

  const fetchSeries = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/series/${seriesId}`);
      if (!res.ok) {
        throw new Error("Serie no encontrada");
      }
      const data = await res.json();
      setSeries(data);

      // Expand first season by default
      if (data.seasons?.length > 0) {
        setExpandedSeasons(new Set([data.seasons[0].id]));
      }
    } catch (err: any) {
      console.error("Error fetching series:", err);
      setError(err?.message ?? "Error al cargar la serie");
    } finally {
      setLoading(false);
    }
  };

  const toggleSeason = (seasonId: string) => {
    setExpandedSeasons((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(seasonId)) {
        newSet.delete(seasonId);
      } else {
        newSet.add(seasonId);
      }
      return newSet;
    });
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-6 flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-destructive">{error || "Serie no encontrada"}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalEpisodes = series.seasons.reduce(
    (acc, s) => acc + s.episodes.length,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Series Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Thumbnail */}
          <div className="aspect-video md:aspect-[2/3] relative bg-muted rounded-lg overflow-hidden">
            {series.thumbnailUrl ? (
              <Image
                src={series.thumbnailUrl}
                alt={series.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Tv className="h-20 w-20 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="md:col-span-2 space-y-4">
            <div>
              {series.category && (
                <p className="text-primary font-medium mb-2">
                  {series.category.name}
                </p>
              )}
              <h1 className="text-4xl font-bold mb-2">{series.title}</h1>
              <p className="text-muted-foreground">
                {series.seasons.length} Temporada
                {series.seasons.length !== 1 ? "s" : ""} · {totalEpisodes}{" "}
                Episodio{totalEpisodes !== 1 ? "s" : ""}
              </p>
            </div>

            {series.description && (
              <p className="text-foreground/80 text-lg">{series.description}</p>
            )}

            {/* Play first episode button */}
            {series.seasons[0]?.episodes[0] && (
              <Link
                href={`/watch/episode/${series.seasons[0].episodes[0].id}`}
                className="inline-flex items-center px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition font-medium"
              >
                <Play className="h-5 w-5 mr-2" />
                Reproducir S1E1
              </Link>
            )}
          </div>
        </div>

        {/* Seasons & Episodes */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Episodios</h2>

          {series.seasons.map((season) => (
            <div
              key={season.id}
              className="border border-border rounded-lg overflow-hidden"
            >
              {/* Season Header */}
              <button
                onClick={() => toggleSeason(season.id)}
                className="w-full flex items-center justify-between p-4 bg-card hover:bg-card/80 transition"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-semibold">
                    Temporada {season.number}
                  </span>
                  {season.title && (
                    <span className="text-muted-foreground">- {season.title}</span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    ({season.episodes.length} episodios)
                  </span>
                </div>
                {expandedSeasons.has(season.id) ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>

              {/* Episodes List */}
              <AnimatePresence>
                {expandedSeasons.has(season.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-border">
                      {season.episodes.map((episode) => (
                        <Link
                          key={episode.id}
                          href={`/watch/episode/${episode.id}`}
                          className="flex items-center p-4 hover:bg-secondary/50 transition group"
                        >
                          {/* Episode Number */}
                          <div className="w-12 h-12 flex items-center justify-center text-2xl font-bold text-muted-foreground group-hover:text-primary transition">
                            {episode.number}
                          </div>

                          {/* Thumbnail */}
                          <div className="w-32 aspect-video relative bg-muted rounded overflow-hidden mx-4 flex-shrink-0">
                            {episode.thumbnailUrl ? (
                              <Image
                                src={episode.thumbnailUrl}
                                alt={episode.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Play className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}

                            {/* Play overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <Play className="h-8 w-8 text-white" />
                            </div>

                            {/* HLS status badge */}
                            {episode.hlsStatus === "completed" && (
                              <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-green-500 text-white text-[10px] rounded">
                                HLS
                              </div>
                            )}
                          </div>

                          {/* Episode Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate group-hover:text-primary transition">
                              {episode.title}
                            </h4>
                            {episode.description && (
                              <p className="text-sm text-muted-foreground truncate">
                                {episode.description}
                              </p>
                            )}
                          </div>

                          {/* Duration */}
                          {episode.duration && (
                            <div className="text-sm text-muted-foreground ml-4">
                              {formatDuration(episode.duration)}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
