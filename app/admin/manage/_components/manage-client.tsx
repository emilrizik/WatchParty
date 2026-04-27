"use client";

import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Film, Tv, Loader2, CheckCircle, Clock, AlertCircle, RefreshCw, Plus, Upload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

interface Video {
  id: string;
  title: string;
  hlsStatus: string | null;
  category: { name: string };
  createdAt: string;
}

interface Episode {
  id: string;
  title: string;
  episodeNumber: number;
  number: number;
  hlsStatus: string | null;
}

interface Season {
  id: string;
  seasonNumber: number;
  number: number;
  episodes: Episode[];
}

interface Series {
  id: string;
  title: string;
  category: { name: string };
  createdAt: string;
  seasons: Season[];
}

export function ManageClient() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "video" | "series" | "episode";
    id: string;
    title: string;
  } | null>(null);
  
  // Add episode dialog state
  const [addEpisodeDialog, setAddEpisodeDialog] = useState<{
    open: boolean;
    seriesId: string;
    seriesTitle: string;
    seasonId: string;
    seasonNumber: number;
  } | null>(null);
  
  // Add season dialog state
  const [addSeasonDialog, setAddSeasonDialog] = useState<{
    open: boolean;
    seriesId: string;
    seriesTitle: string;
  } | null>(null);
  const [newSeasonNumber, setNewSeasonNumber] = useState<number>(1);
  const [addingSeasonLoading, setAddingSeasonLoading] = useState(false);
  
  // Multiple episodes upload state
  interface PendingEpisode {
    id: string;
    file: File;
    episodeNumber: number;
    title: string;
  }
  const [pendingEpisodes, setPendingEpisodes] = useState<PendingEpisode[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchContent = async () => {
    setLoading(true);
    try {
      const [videosRes, seriesRes] = await Promise.all([
        fetch("/api/videos"),
        fetch("/api/series"),
      ]);
      
      if (videosRes.ok) {
        const data = await videosRes.json();
        // API puede devolver { videos: [...] } o directamente [...]
        setVideos(Array.isArray(data) ? data : (data.videos || []));
      }
      
      if (seriesRes.ok) {
        const data = await seriesRes.json();
        // API devuelve directamente el array
        setSeries(Array.isArray(data) ? data : (data.series || []));
      }
    } catch (error) {
      console.error("Error fetching content:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const handleDelete = async () => {
    if (!deleteDialog) return;
    
    setDeleting(true);
    try {
      let url = "";
      if (deleteDialog.type === "video") {
        url = `/api/videos/${deleteDialog.id}`;
      } else if (deleteDialog.type === "series") {
        url = `/api/series/${deleteDialog.id}`;
      } else if (deleteDialog.type === "episode") {
        url = `/api/episodes/${deleteDialog.id}`;
      }
      
      const res = await fetch(url, { method: "DELETE" });
      
      if (res.ok) {
        toast({
          title: "Eliminado",
          description: `${deleteDialog.title} ha sido eliminado correctamente.`,
        });
        fetchContent();
      } else {
        throw new Error("Error al eliminar");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el contenido.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialog(null);
    }
  };

  // Upload file helper
  const uploadFile = async (file: File): Promise<string> => {
    const presignedRes = await fetch("/api/videos/upload-presigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        isPublic: true,
      }),
    });

    if (!presignedRes.ok) throw new Error("Error al obtener URL de subida");

    const { uploadUrl, cloud_storage_path } = await presignedRes.json();

    const urlParams = new URLSearchParams(uploadUrl.split("?")[1]);
    const signedHeaders = urlParams.get("X-Amz-SignedHeaders") ?? "";
    const needsContentDisposition = signedHeaders.includes("content-disposition");

    const uploadHeaders: HeadersInit = { "Content-Type": file.type };
    if (needsContentDisposition) {
      uploadHeaders["Content-Disposition"] = "attachment";
    }

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: file,
    });

    if (!uploadRes.ok) throw new Error("Error al subir archivo");

    return cloud_storage_path;
  };

  // Handle file selection for multiple episodes
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newEpisodes: PendingEpisode[] = [];
    // Find highest episode number already in the list
    const existingNumbers = pendingEpisodes.map(e => e.episodeNumber);
    let nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Try to extract episode number from filename
      const match = file.name.match(/[Ee]?(\d+)/);
      let episodeNumber = match ? parseInt(match[1]) : nextNumber;
      
      // If number already exists in pending, increment
      while (existingNumbers.includes(episodeNumber) || newEpisodes.some(e => e.episodeNumber === episodeNumber)) {
        episodeNumber = nextNumber++;
      }
      
      newEpisodes.push({
        id: `${Date.now()}-${i}`,
        file,
        episodeNumber,
        title: `Episodio ${episodeNumber}`,
      });
      nextNumber = episodeNumber + 1;
    }
    
    setPendingEpisodes(prev => [...prev, ...newEpisodes].sort((a, b) => a.episodeNumber - b.episodeNumber));
  };

  // Update episode number
  const updateEpisodeNumber = (id: string, newNumber: number) => {
    setPendingEpisodes(prev => 
      prev.map(ep => ep.id === id ? { ...ep, episodeNumber: newNumber, title: `Episodio ${newNumber}` } : ep)
        .sort((a, b) => a.episodeNumber - b.episodeNumber)
    );
  };

  // Update episode title
  const updateEpisodeTitle = (id: string, newTitle: string) => {
    setPendingEpisodes(prev => 
      prev.map(ep => ep.id === id ? { ...ep, title: newTitle } : ep)
    );
  };

  // Remove pending episode
  const removePendingEpisode = (id: string) => {
    setPendingEpisodes(prev => prev.filter(ep => ep.id !== id));
  };

  // Add episodes handler (batch upload)
  const handleAddEpisodes = async () => {
    if (!addEpisodeDialog || pendingEpisodes.length === 0) return;

    setUploading(true);
    setCurrentUploadIndex(0);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingEpisodes.length; i++) {
      const episode = pendingEpisodes[i];
      setCurrentUploadIndex(i + 1);
      setUploadProgress(`Subiendo ${i + 1}/${pendingEpisodes.length}: ${episode.title}...`);

      try {
        // Upload video file
        const cloud_storage_path = await uploadFile(episode.file);

        // Create episode
        const episodeRes = await fetch(`/api/seasons/${addEpisodeDialog.seasonId}/episodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: episode.episodeNumber,
            title: episode.title,
            cloud_storage_path,
            isPublic: true,
          }),
        });

        if (!episodeRes.ok) {
          const err = await episodeRes.json();
          throw new Error(err.error || "Error al crear episodio");
        }
        successCount++;
      } catch (error: any) {
        console.error(`Error uploading episode ${episode.episodeNumber}:`, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Episodios agregados",
        description: `${successCount} episodio(s) agregado(s) correctamente.${failCount > 0 ? ` ${failCount} fallaron.` : ''} La conversión HLS comenzará automáticamente.`,
      });
    } else {
      toast({
        title: "Error",
        description: "No se pudieron agregar los episodios.",
        variant: "destructive",
      });
    }

    setPendingEpisodes([]);
    setAddEpisodeDialog(null);
    setUploading(false);
    setUploadProgress("");
    fetchContent();
  };

  // Add season handler
  const handleAddSeason = async () => {
    if (!addSeasonDialog) return;

    setAddingSeasonLoading(true);
    try {
      const res = await fetch(`/api/series/${addSeasonDialog.seriesId}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: newSeasonNumber }),
      });

      if (res.ok) {
        const newSeason = await res.json();
        toast({
          title: "Temporada agregada",
          description: `Temporada ${newSeason.number} agregada a ${addSeasonDialog.seriesTitle}.`,
        });
        fetchContent();
        setAddSeasonDialog(null);
        setNewSeasonNumber(1);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Error al crear temporada");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message ?? "No se pudo crear la temporada",
        variant: "destructive",
      });
    } finally {
      setAddingSeasonLoading(false);
    }
  };

  // Retry conversion for failed items
  const [retrying, setRetrying] = useState<string | null>(null);
  
  const retryConversion = async (type: 'video' | 'episode', id: string) => {
    setRetrying(id);
    try {
      const body = type === 'video' ? { videoId: id } : { episodeId: id };
      const res = await fetch('/api/convert-hls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        toast({
          title: "Conversión iniciada",
          description: "La optimización del video comenzará en breve.",
        });
        fetchContent();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Error al reintentar');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message ?? "No se pudo reiniciar la conversión",
        variant: "destructive",
      });
    } finally {
      setRetrying(null);
    }
  };

  const getHlsStatusBadge = (status: string | null, type?: 'video' | 'episode', id?: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completado
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-yellow-600">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Procesando
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-blue-600">
            <Clock className="w-3 h-3 mr-1" />
            Pendiente
          </Badge>
        );
      case "failed":
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-red-600">
              <AlertCircle className="w-3 h-3 mr-1" />
              Error
            </Badge>
            {type && id && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs border-red-600 text-red-400 hover:bg-red-600/20"
                onClick={() => retryConversion(type, id)}
                disabled={retrying === id}
              >
                {retrying === id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </Button>
            )}
          </div>
        );
      default:
        return (
          <Badge variant="secondary">
            Sin optimizar
          </Badge>
        );
    }
  };

  const pendingConversions = [
    ...videos.filter(v => v.hlsStatus === "processing" || v.hlsStatus === "pending"),
    ...series.flatMap(s => 
      s.seasons.flatMap(season => 
        season.episodes.filter(e => e.hlsStatus === "processing" || e.hlsStatus === "pending")
          .map(e => ({ ...e, seriesTitle: s.title, seasonNumber: season.seasonNumber }))
      )
    )
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Gestión de Contenido</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchContent}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            <Link href="/admin">
              <Button variant="secondary">Volver al Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* HLS Conversion Status */}
        {pendingConversions.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
                Conversiones HLS en Progreso ({pendingConversions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingConversions.map((item: any, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                    <span className="text-zinc-300">
                      {item.seriesTitle ? `${item.seriesTitle} - T${item.seasonNumber} E${item.episodeNumber}` : item.title}
                    </span>
                    {getHlsStatusBadge(item.hlsStatus, item.seriesTitle ? 'episode' : 'video', item.id)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="videos" className="space-y-6">
          <TabsList className="bg-zinc-900">
            <TabsTrigger value="videos" className="data-[state=active]:bg-red-600">
              <Film className="w-4 h-4 mr-2" />
              Películas/Videos ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="series" className="data-[state=active]:bg-red-600">
              <Tv className="w-4 h-4 mr-2" />
              Series ({series.length})
            </TabsTrigger>
            <TabsTrigger value="hls" className="data-[state=active]:bg-red-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              Estado HLS
            </TabsTrigger>
          </TabsList>

          {/* Videos Tab */}
          <TabsContent value="videos">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Películas y Documentales</CardTitle>
              </CardHeader>
              <CardContent>
                {videos.length === 0 ? (
                  <p className="text-zinc-400">No hay videos subidos.</p>
                ) : (
                  <div className="space-y-3">
                    {videos.map((video) => (
                      <div
                        key={video.id}
                        className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition"
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{video.title}</h3>
                          <p className="text-sm text-zinc-400">
                            {video.category.name} • {new Date(video.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {getHlsStatusBadge(video.hlsStatus, 'video', video.id)}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: "video",
                                id: video.id,
                                title: video.title,
                              })
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Series Tab */}
          <TabsContent value="series">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Series</CardTitle>
              </CardHeader>
              <CardContent>
                {series.length === 0 ? (
                  <p className="text-zinc-400">No hay series subidas.</p>
                ) : (
                  <div className="space-y-6">
                    {series.map((s) => (
                      <div key={s.id} className="bg-zinc-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-white">{s.title}</h3>
                            <p className="text-sm text-zinc-400">
                              {s.category.name} • {s.seasons.length} temporada(s)
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-400 border-green-600 hover:bg-green-600/20"
                              onClick={() => {
                                // Calculate next season number
                                const maxSeason = s.seasons.length > 0 
                                  ? Math.max(...s.seasons.map(se => se.seasonNumber || se.number))
                                  : 0;
                                setNewSeasonNumber(maxSeason + 1);
                                setAddSeasonDialog({
                                  open: true,
                                  seriesId: s.id,
                                  seriesTitle: s.title,
                                });
                              }}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Agregar Temporada
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() =>
                                setDeleteDialog({
                                  open: true,
                                  type: "series",
                                  id: s.id,
                                  title: s.title,
                                })
                              }
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar Serie
                            </Button>
                          </div>
                        </div>

                        {s.seasons.map((season) => (
                          <div key={season.id} className="ml-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-lg font-semibold text-zinc-300">
                                Temporada {season.seasonNumber || season.number}
                              </h4>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-400 border-green-600 hover:bg-green-600/20"
                                onClick={() => {
                                  setAddEpisodeDialog({
                                    open: true,
                                    seriesId: s.id,
                                    seriesTitle: s.title,
                                    seasonId: season.id,
                                    seasonNumber: season.seasonNumber || season.number,
                                  });
                                  setPendingEpisodes([]);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Agregar Episodios
                              </Button>
                            </div>
                            <div className="space-y-2 ml-4">
                              {season.episodes.map((episode) => (
                                <div
                                  key={episode.id}
                                  className="flex items-center justify-between p-3 bg-zinc-700 rounded-lg"
                                >
                                  <span className="text-zinc-300">
                                    E{episode.episodeNumber || episode.number}: {episode.title}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    {getHlsStatusBadge(episode.hlsStatus, 'episode', episode.id)}
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() =>
                                        setDeleteDialog({
                                          open: true,
                                          type: "episode",
                                          id: episode.id,
                                          title: `${s.title} - T${season.seasonNumber || season.number} E${episode.episodeNumber || episode.number}`,
                                        })
                                      }
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HLS Status Tab */}
          <TabsContent value="hls">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Estado de Conversión HLS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <p className="text-2xl font-bold text-green-500">
                        {videos.filter(v => v.hlsStatus === "completed").length +
                          series.flatMap(s => s.seasons.flatMap(se => se.episodes)).filter(e => e.hlsStatus === "completed").length}
                      </p>
                      <p className="text-sm text-zinc-400">Completados</p>
                    </div>
                    <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 text-center">
                      <Loader2 className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                      <p className="text-2xl font-bold text-yellow-500">
                        {videos.filter(v => v.hlsStatus === "processing").length +
                          series.flatMap(s => s.seasons.flatMap(se => se.episodes)).filter(e => e.hlsStatus === "processing").length}
                      </p>
                      <p className="text-sm text-zinc-400">Procesando</p>
                    </div>
                    <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 text-center">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-2xl font-bold text-blue-500">
                        {videos.filter(v => v.hlsStatus === "pending").length +
                          series.flatMap(s => s.seasons.flatMap(se => se.episodes)).filter(e => e.hlsStatus === "pending").length}
                      </p>
                      <p className="text-sm text-zinc-400">Pendientes</p>
                    </div>
                    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-center">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                      <p className="text-2xl font-bold text-red-500">
                        {videos.filter(v => v.hlsStatus === "failed").length +
                          series.flatMap(s => s.seasons.flatMap(se => se.episodes)).filter(e => e.hlsStatus === "failed").length}
                      </p>
                      <p className="text-sm text-zinc-400">Fallidos</p>
                    </div>
                  </div>

                  {/* Detailed List */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Detalle de Contenido</h3>
                    <div className="space-y-2">
                      {videos.map((video) => (
                        <div key={video.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Film className="w-5 h-5 text-zinc-400" />
                            <span className="text-zinc-300">{video.title}</span>
                          </div>
                          {getHlsStatusBadge(video.hlsStatus, 'video', video.id)}
                        </div>
                      ))}
                      {series.flatMap((s) =>
                        s.seasons.flatMap((season) =>
                          season.episodes.map((episode) => (
                            <div key={episode.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Tv className="w-5 h-5 text-zinc-400" />
                                <span className="text-zinc-300">
                                  {s.title} - T{season.seasonNumber} E{episode.episodeNumber}: {episode.title}
                                </span>
                              </div>
                              {getHlsStatusBadge(episode.hlsStatus, 'episode', episode.id)}
                            </div>
                          ))
                        )
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog?.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar {deleteDialog?.title}?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Esta acción no se puede deshacer. Se eliminará permanentemente
              {deleteDialog?.type === "series" && " la serie completa con todas sus temporadas y episodios"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-700 text-white hover:bg-zinc-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Episodes Dialog */}
      <Dialog open={addEpisodeDialog?.open} onOpenChange={(open) => { if (!open && !uploading) { setAddEpisodeDialog(null); setPendingEpisodes([]); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Agregar Episodios a {addEpisodeDialog?.seriesTitle}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Temporada {addEpisodeDialog?.seasonNumber} - Puedes subir múltiples episodios a la vez
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* File selector */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Seleccionar videos</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
                disabled={uploading}
              />
              <Button
                variant="outline"
                className="w-full border-dashed border-zinc-600 hover:bg-zinc-800"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Seleccionar videos (múltiples)
              </Button>
              <p className="text-xs text-zinc-500">
                Tip: Si el nombre del archivo contiene un número (ej: "E05.mp4"), se usará como número de episodio.
              </p>
            </div>
            
            {/* Pending episodes list */}
            {pendingEpisodes.length > 0 && (
              <div className="space-y-3">
                <Label className="text-zinc-300">Episodios a subir ({pendingEpisodes.length})</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pendingEpisodes.map((ep) => (
                    <div key={ep.id} className="flex items-center gap-2 p-3 bg-zinc-800 rounded-lg">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Label className="text-zinc-400 text-sm">Ep #</Label>
                        <Input
                          type="number"
                          min="1"
                          value={ep.episodeNumber}
                          onChange={(e) => updateEpisodeNumber(ep.id, parseInt(e.target.value) || 1)}
                          className="w-16 bg-zinc-700 border-zinc-600 text-white text-center"
                          disabled={uploading}
                        />
                      </div>
                      <Input
                        value={ep.title}
                        onChange={(e) => updateEpisodeTitle(ep.id, e.target.value)}
                        className="flex-1 bg-zinc-700 border-zinc-600 text-white"
                        placeholder="Título del episodio"
                        disabled={uploading}
                      />
                      <span className="text-xs text-zinc-500 truncate max-w-32" title={ep.file.name}>
                        {ep.file.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePendingEpisode(ep.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        disabled={uploading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {uploadProgress && (
              <div className="bg-zinc-800 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{uploadProgress}</span>
                </div>
                <div className="mt-2 w-full bg-zinc-700 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all"
                    style={{ width: `${(currentUploadIndex / pendingEpisodes.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAddEpisodeDialog(null); setPendingEpisodes([]); }}
              className="bg-zinc-700 text-white hover:bg-zinc-600"
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddEpisodes}
              disabled={uploading || pendingEpisodes.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Subiendo {currentUploadIndex}/{pendingEpisodes.length}...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Subir {pendingEpisodes.length} Episodio(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Season Dialog */}
      <Dialog open={addSeasonDialog?.open} onOpenChange={(open) => { if (!open) { setAddSeasonDialog(null); setNewSeasonNumber(1); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              Agregar Temporada a {addSeasonDialog?.seriesTitle}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Ingresa el número de la nueva temporada
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Número de Temporada</Label>
              <Input
                type="number"
                min="1"
                value={newSeasonNumber}
                onChange={(e) => setNewSeasonNumber(parseInt(e.target.value) || 1)}
                className="bg-zinc-700 border-zinc-600 text-white"
                disabled={addingSeasonLoading}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAddSeasonDialog(null); setNewSeasonNumber(1); }}
              className="bg-zinc-700 text-white hover:bg-zinc-600"
              disabled={addingSeasonLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddSeason}
              disabled={addingSeasonLoading || newSeasonNumber < 1}
              className="bg-green-600 hover:bg-green-700"
            >
              {addingSeasonLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Temporada {newSeasonNumber}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
