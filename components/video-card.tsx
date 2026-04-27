"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, Clock, Users } from "lucide-react";
import { motion } from "framer-motion";

interface VideoCardProps {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  category?: {
    name: string;
  } | null;
}

export function VideoCard({
  id,
  title,
  thumbnailUrl,
  duration,
  category,
}: VideoCardProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.03 }}
      className="group relative"
    >
      <Link href={`/watch/${id}`}>
        <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden shadow-lg">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={title}
              fill
              className="object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="h-16 w-16 text-muted-foreground" />
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <Play className="h-12 w-12 text-white" fill="white" />
          </div>

          {/* Duration badge */}
          {duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(duration)}</span>
            </div>
          )}
        </div>

        <div className="mt-3">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition">
            {title}
          </h3>
          {category && (
            <p className="text-sm text-muted-foreground mt-1">
              {category.name}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
