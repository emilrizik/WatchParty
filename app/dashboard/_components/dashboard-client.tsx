"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { VideoCard } from "@/components/video-card";
import { SeriesCard } from "@/components/series-card";
import { Film, Tv, Loader2, AlertCircle, Users, Play, Pause } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { writeStoredParticipant } from "@/lib/client-storage";

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

interface Series {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  seasons: Array<{
    episodes: Array<{ id: string }>;
  }>;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  _count?: {
    videos: number;
  };
}

interface ActiveRoom {
  id: string;
  code: string;
  name: string;
  type: "video" | "episode";
  isPlaying: boolean;
  content: {
    id: string;
    title: string;
    thumbnailUrl?: string | null;
    seriesTitle?: string;
    episodeTitle?: string;
  };
  participants: Array<{ id: string; guestName: string }>;
  createdAt: string;
}

export function DashboardClient() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [contentType, setContentType] = useState<"videos" | "series">("videos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Join room dialog
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ActiveRoom | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchData();
    fetchActiveRooms();
    // Poll active rooms every 10 seconds
    const interval = setInterval(fetchActiveRooms, 10000);
    return () => clearInterval(interval);
  }, [selectedCategory]);

  const fetchActiveRooms = async () => {
    try {
      const res = await fetch("/api/rooms/active");
      if (res.ok) {
        const rooms = await res.json();
        setActiveRooms(rooms);
      }
    } catch (err) {
      console.error("Error fetching active rooms:", err);
    }
  };

  const handleJoinRoom = (room: ActiveRoom) => {
    setSelectedRoom(room);
    setShowJoinDialog(true);
  };

  const confirmJoinRoom = async () => {
    if (!selectedRoom || !joinName.trim()) return;
    
    setJoining(true);
    try {
      const endpoint = selectedRoom.type === "episode" 
        ? "/api/rooms/episode/join" 
        : "/api/rooms/join";
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: selectedRoom.code, 
          guestName: joinName.trim() 
        }),
      });

      if (res.ok) {
        const data = await res.json();
        writeStoredParticipant(selectedRoom.code, {
          id: data.participantId,
          name: joinName.trim(),
        });
        
        if (selectedRoom.type === "episode") {
          router.push(`/watch/episode/${data.episode.id}?room=${selectedRoom.code}`);
        } else {
          router.push(`/watch/${data.video.id}?room=${selectedRoom.code}`);
        }
      }
    } catch (err) {
      console.error("Error joining room:", err);
    } finally {
      setJoining(false);
      setShowJoinDialog(false);
      setJoinName("");
      setSelectedRoom(null);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      let categoriesData: Category[] = [];

      // Fetch categories
      const categoriesRes = await fetch("/api/categories");
      if (categoriesRes.ok) {
        categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

      // Fetch videos
      let videosUrl = "/api/videos";
      if (selectedCategory) {
        videosUrl = `/api/videos/by-category?slug=${selectedCategory}`;
      }

      const videosRes = await fetch(videosUrl);
      if (!videosRes.ok) {
        throw new Error("Error al cargar videos");
      }

      const videosData = await videosRes.json();
      setVideos(videosData?.videos ?? videosData);

      // Fetch series
      const seriesRes = await fetch("/api/series");
      if (seriesRes.ok) {
        let seriesData = await seriesRes.json();
        // Filter by category if selected
        if (selectedCategory) {
          const selectedCat = categoriesData.find((c) => c.slug === selectedCategory);
          if (selectedCat) {
            seriesData = seriesData.filter(
              (s: Series) => s.category?.id === selectedCat.id
            );
          }
        }
        setSeries(seriesData);
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err?.message ?? "Error al cargar contenido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Rooms Section */}
        {activeRooms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <Users className="h-6 w-6 text-green-500" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold">Salas Activas</h2>
              <span className="text-sm text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                {activeRooms.length} {activeRooms.length === 1 ? "sala" : "salas"}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeRooms.map((room) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => handleJoinRoom(room)}
                >
                  <div className="flex">
                    {/* Thumbnail */}
                    <div className="relative w-28 h-28 flex-shrink-0">
                      {room.content.thumbnailUrl ? (
                        <Image
                          src={room.content.thumbnailUrl}
                          alt={room.content.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                          <Film className="w-8 h-8 text-zinc-500" />
                        </div>
                      )}
                      {/* Playing indicator */}
                      <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                        room.isPlaying 
                          ? "bg-green-500/90 text-white" 
                          : "bg-yellow-500/90 text-black"
                      }`}>
                        {room.isPlaying ? (
                          <>
                            <Play className="w-3 h-3" fill="currentColor" />
                            En vivo
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3" />
                            Pausado
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div>
                        <p className="text-sm text-zinc-400 truncate">
                          {room.type === "episode" ? "Serie" : "Película"}
                        </p>
                        <h3 className="font-semibold text-white truncate">
                          {room.content.title}
                        </h3>
                      </div>
                      
                      {/* Participants */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex -space-x-2">
                          {room.participants.slice(0, 4).map((p, idx) => (
                            <div
                              key={p.id}
                              className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-xs font-bold text-white border-2 border-zinc-800"
                              title={p.guestName}
                            >
                              {p.guestName.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {room.participants.length > 4 && (
                            <div className="w-7 h-7 rounded-full bg-zinc-600 flex items-center justify-center text-xs font-bold text-white border-2 border-zinc-800">
                              +{room.participants.length - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-zinc-400">
                          {room.participants.map(p => p.guestName).slice(0, 2).join(", ")}
                          {room.participants.length > 2 && ` y ${room.participants.length - 2} más`}
                        </span>
                      </div>
                    </div>
                    
                    {/* Join button */}
                    <div className="flex items-center pr-3">
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Unirse
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Join Room Dialog */}
        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent className="bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Unirse a la sala
              </DialogTitle>
            </DialogHeader>
            {selectedRoom && (
              <div className="space-y-4">
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <p className="text-sm text-zinc-400">Reproduciendo:</p>
                  <p className="font-medium text-white">{selectedRoom.content.title}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {selectedRoom.participants.length} persona(s) viendo
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300">Tu nombre</label>
                  <Input
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="¿Cómo te llamas?"
                    className="bg-zinc-800 border-zinc-700"
                    autoFocus
                  />
                </div>
                
                <Button
                  onClick={confirmJoinRoom}
                  disabled={!joinName.trim() || joining}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {joining ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Unirse ahora
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Disfruta juntos, desde{" "}
            <span className="text-primary">cualquier lugar</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Crea salas sincronizadas y comparte la experiencia con amigos en
            tiempo real
          </p>
        </motion.div>

        {/* Content Type Tabs */}
        <div className="mb-8 flex gap-2">
          <button
            onClick={() => setContentType("videos")}
            className={`px-4 py-2 rounded-lg transition flex items-center ${
              contentType === "videos"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            <Film className="h-4 w-4 mr-2" />
            Películas
          </button>
          <button
            onClick={() => setContentType("series")}
            className={`px-4 py-2 rounded-lg transition flex items-center ${
              contentType === "series"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            <Tv className="h-4 w-4 mr-2" />
            Series ({series?.length ?? 0})
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-6 flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Content Grid */}
        {!loading && !error && (
          <>
            {/* Series Section */}
            {contentType === "series" && series?.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <Tv className="h-6 w-6 mr-2 text-cyan-500" />
                  Series
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {series.map((s) => (
                    <SeriesCard
                      key={s.id}
                      id={s.id}
                      title={s.title}
                      thumbnailUrl={s.thumbnailUrl}
                      totalSeasons={s.seasons?.length ?? 0}
                      totalEpisodes={s.seasons?.reduce((acc, season) => acc + (season.episodes?.length ?? 0), 0) ?? 0}
                      category={s.category}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Videos Section */}
            {contentType === "videos" && videos?.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <Film className="h-6 w-6 mr-2 text-primary" />
                  Películas
                </h2>
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
              </div>
            )}

            {/* Empty State */}
            {videos?.length === 0 && series?.length === 0 && (
              <div className="text-center py-20">
                <Film className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2">
                  No hay contenido aún
                </h2>
                <p className="text-muted-foreground mb-6">
                  Sube tu primer video o serie para empezar
                </p>
                <Link
                  href="/upload"
                  className="inline-flex items-center px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition font-medium"
                >
                  Subir Contenido
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
