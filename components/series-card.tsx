"use client";

import Link from "next/link";
import Image from "next/image";
import { Tv, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";

interface SeriesCardProps {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  totalEpisodes: number;
  totalSeasons: number;
  category?: {
    name: string;
  } | null;
}

export function SeriesCard({
  id,
  title,
  thumbnailUrl,
  totalEpisodes,
  totalSeasons,
  category,
}: SeriesCardProps) {
  return (
    <Link href={`/series/${id}`}>
      <motion.div
        whileHover={{ scale: 1.03 }}
        className="group relative bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/20 hover:border-primary/50"
      >
        {/* Thumbnail */}
        <div className="aspect-video relative bg-muted">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Tv className="h-16 w-16 text-muted-foreground" />
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <PlayCircle className="h-16 w-16 text-white" />
          </div>

          {/* Badge */}
          <div className="absolute top-2 left-2 px-2 py-1 bg-cyan-500 text-white text-xs font-medium rounded">
            Serie
          </div>

          {/* Episodes count */}
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
            {totalSeasons} Temp. · {totalEpisodes} Ep.
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-lg truncate group-hover:text-primary transition">
            {title}
          </h3>
          {category && (
            <p className="text-sm text-muted-foreground truncate">
              {category.name}
            </p>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
