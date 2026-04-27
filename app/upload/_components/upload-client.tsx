"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Upload, Film, Tv, Image as ImageIcon, Loader2, Check, Plus, Trash2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface EpisodeData {
  number: number;
  title: string;
  description: string;
  videoFile: File | null;
  thumbnailFile: File | null;
}

interface SeasonData {
  number: number;
  title: string;
  episodes: EpisodeData[];
}

export function UploadClient() {
  const router = useRouter();
  const [uploadType, setUploadType] = useState<"video" | "series">("video");
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Video state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Series state
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");
  const [seriesCategoryId, setSeriesCategoryId] = useState("");
  const [seriesThumbnailFile, setSeriesThumbnailFile] = useState<File | null>(null);
  const [seasons, setSeasons] = useState<SeasonData[]>([
    { number: 1, title: "", episodes: [{ number: 1, title: "", description: "", videoFile: null, thumbnailFile: null }] }
  ]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  // Upload a file and return cloud_storage_path
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

  // Video upload handler
  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setUploading(true);
    setUploadProgress(0);

    try {
      if (!videoFile) throw new Error("Selecciona un video");

      setUploadProgress(10);
      setUploadStatus("Subiendo video...");
      const cloud_storage_path = await uploadFile(videoFile);
      setUploadProgress(60);

      let thumbnail_path: string | undefined;
      if (thumbnailFile) {
        setUploadStatus("Subiendo miniatura...");
        thumbnail_path = await uploadFile(thumbnailFile);
      }
      setUploadProgress(80);

      setUploadStatus("Guardando...");
      const completeRes = await fetch("/api/videos/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          cloud_storage_path,
          isPublic: true,
          thumbnail_path,
          thumbnailIsPublic: true,
          categoryId: categoryId || null,
        }),
      });

      if (!completeRes.ok) throw new Error("Error al guardar el video");

      setUploadProgress(100);
      setUploadStatus("Conversión HLS en progreso...");
      setSuccess(true);

      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message ?? "Error al subir el video");
    } finally {
      setUploading(false);
    }
  };

  // Series upload handler
  const handleSeriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setUploading(true);
    setUploadProgress(0);

    try {
      if (!seriesTitle) throw new Error("El título de la serie es requerido");

      // Count total episodes for progress
      const totalEpisodes = seasons.reduce((acc, s) => acc + s.episodes.filter(ep => ep.videoFile).length, 0);
      if (totalEpisodes === 0) throw new Error("Agrega al menos un episodio con video");

      let currentProgress = 5;
      const progressPerEpisode = 80 / totalEpisodes;

      // Upload series thumbnail
      setUploadStatus("Subiendo miniatura de la serie...");
      let seriesThumbnailPath: string | undefined;
      if (seriesThumbnailFile) {
        seriesThumbnailPath = await uploadFile(seriesThumbnailFile);
      }
      currentProgress += 5;
      setUploadProgress(currentProgress);

      // Create series
      setUploadStatus("Creando serie...");
      const seriesRes = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: seriesTitle,
          description: seriesDescription,
          categoryId: seriesCategoryId || null,
          thumbnail_path: seriesThumbnailPath,
          thumbnailIsPublic: true,
        }),
      });

      if (!seriesRes.ok) throw new Error("Error al crear la serie");
      const seriesData = await seriesRes.json();
      currentProgress += 5;
      setUploadProgress(currentProgress);

      // Create seasons and episodes
      for (const season of seasons) {
        setUploadStatus(`Creando Temporada ${season.number}...`);
        const seasonRes = await fetch(`/api/series/${seriesData.id}/seasons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: season.number,
            title: season.title,
          }),
        });

        if (!seasonRes.ok) throw new Error(`Error al crear temporada ${season.number}`);
        const seasonData = await seasonRes.json();

        // Upload episodes
        for (const episode of season.episodes) {
          if (!episode.videoFile) continue;

          setUploadStatus(`Subiendo S${season.number}E${episode.number}: ${episode.title || 'Episodio'}...`);
          
          // Upload video
          const videoPath = await uploadFile(episode.videoFile);
          
          // Upload thumbnail if exists
          let thumbPath: string | undefined;
          if (episode.thumbnailFile) {
            thumbPath = await uploadFile(episode.thumbnailFile);
          }

          // Create episode
          const episodeRes = await fetch(`/api/seasons/${seasonData.id}/episodes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              number: episode.number,
              title: episode.title || `Episodio ${episode.number}`,
              description: episode.description,
              cloud_storage_path: videoPath,
              isPublic: true,
              thumbnail_path: thumbPath,
              thumbnailIsPublic: true,
            }),
          });

          if (!episodeRes.ok) throw new Error(`Error al crear episodio ${episode.number}`);

          currentProgress += progressPerEpisode;
          setUploadProgress(Math.min(currentProgress, 95));
        }
      }

      setUploadProgress(100);
      setUploadStatus("Conversión HLS en progreso para cada episodio...");
      setSuccess(true);

      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      console.error("Series upload error:", err);
      setError(err?.message ?? "Error al subir la serie");
    } finally {
      setUploading(false);
    }
  };

  // Season management
  const addSeason = () => {
    setSeasons([...seasons, {
      number: seasons.length + 1,
      title: "",
      episodes: [{ number: 1, title: "", description: "", videoFile: null, thumbnailFile: null }]
    }]);
  };

  const removeSeason = (index: number) => {
    if (seasons.length <= 1) return;
    const newSeasons = seasons.filter((_, i) => i !== index).map((s, i) => ({ ...s, number: i + 1 }));
    setSeasons(newSeasons);
  };

  const updateSeason = (index: number, field: string, value: any) => {
    const newSeasons = [...seasons];
    (newSeasons[index] as any)[field] = value;
    setSeasons(newSeasons);
  };

  // Episode management
  const addEpisode = (seasonIndex: number) => {
    const newSeasons = [...seasons];
    newSeasons[seasonIndex].episodes.push({
      number: newSeasons[seasonIndex].episodes.length + 1,
      title: "",
      description: "",
      videoFile: null,
      thumbnailFile: null,
    });
    setSeasons(newSeasons);
  };

  const removeEpisode = (seasonIndex: number, episodeIndex: number) => {
    const newSeasons = [...seasons];
    if (newSeasons[seasonIndex].episodes.length <= 1) return;
    newSeasons[seasonIndex].episodes = newSeasons[seasonIndex].episodes
      .filter((_, i) => i !== episodeIndex)
      .map((ep, i) => ({ ...ep, number: i + 1 }));
    setSeasons(newSeasons);
  };

  const updateEpisode = (seasonIndex: number, episodeIndex: number, field: string, value: any) => {
    const newSeasons = [...seasons];
    (newSeasons[seasonIndex].episodes[episodeIndex] as any)[field] = value;
    setSeasons(newSeasons);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Subir Contenido</h1>
          <p className="text-muted-foreground">
            Comparte películas, documentales o series completas
          </p>
        </div>

        {/* Upload Type Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            type="button"
            onClick={() => setUploadType("video")}
            className={`flex-1 py-4 rounded-lg border-2 transition flex items-center justify-center gap-3 ${
              uploadType === "video"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Film className="h-6 w-6" />
            <span className="font-medium">Película / Documental</span>
          </button>
          <button
            type="button"
            onClick={() => setUploadType("series")}
            className={`flex-1 py-4 rounded-lg border-2 transition flex items-center justify-center gap-3 ${
              uploadType === "series"
                ? "border-cyan-500 bg-cyan-500/10 text-cyan-500"
                : "border-border hover:border-cyan-500/50"
            }`}
          >
            <Tv className="h-6 w-6" />
            <span className="font-medium">Serie (Temporadas)</span>
          </button>
        </div>

        {/* Video Upload Form */}
        {uploadType === "video" && (
          <form
            onSubmit={handleVideoSubmit}
            className="bg-card border border-border rounded-lg p-6 space-y-6"
          >
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">Título *</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
                placeholder="Nombre del video"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">Descripción</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition resize-none"
                placeholder="Descripción del video (opcional)"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium mb-2">Categoría</label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Sin categoría</option>
                {categories.filter(cat => cat.slug !== "series").map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Archivo de Video *</label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="video-file"
                />
                <label htmlFor="video-file" className="cursor-pointer flex flex-col items-center">
                  <Film className="h-12 w-12 text-muted-foreground mb-3" />
                  {videoFile ? (
                    <p className="text-sm font-medium">{videoFile.name}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-1">Click para seleccionar video</p>
                      <p className="text-xs text-muted-foreground">MP4, WebM, MOV</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Miniatura (opcional)</label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="thumbnail-file"
                />
                <label htmlFor="thumbnail-file" className="cursor-pointer flex flex-col items-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-3" />
                  {thumbnailFile ? (
                    <p className="text-sm font-medium">{thumbnailFile.name}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-1">Click para seleccionar imagen</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG, WebP</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/50 text-green-500 px-4 py-3 rounded-lg text-sm flex items-center">
                <Check className="h-5 w-5 mr-2" />
                ¡Video subido! La conversión HLS se realiza en segundo plano.
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{uploadStatus}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || success}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <><Loader2 className="animate-spin mr-2 h-5 w-5" />Subiendo...</>
              ) : success ? (
                <><Check className="mr-2 h-5 w-5" />Completado</>
              ) : (
                <><Upload className="mr-2 h-5 w-5" />Subir Video</>
              )}
            </button>
          </form>
        )}

        {/* Series Upload Form */}
        {uploadType === "series" && (
          <form
            onSubmit={handleSeriesSubmit}
            className="bg-card border border-border rounded-lg p-6 space-y-6"
          >
            {/* Series Info */}
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <h3 className="font-semibold text-cyan-500 mb-4 flex items-center">
                <Tv className="h-5 w-5 mr-2" />
                Información de la Serie
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Título de la Serie *</label>
                  <input
                    type="text"
                    value={seriesTitle}
                    onChange={(e) => setSeriesTitle(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                    placeholder="Ej: Breaking Bad"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Descripción</label>
                  <textarea
                    value={seriesDescription}
                    onChange={(e) => setSeriesDescription(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition resize-none"
                    placeholder="Descripción de la serie"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Categoría</label>
                    <select
                      value={seriesCategoryId}
                      onChange={(e) => setSeriesCategoryId(e.target.value)}
                      className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Miniatura</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSeriesThumbnailFile(e.target.files?.[0] ?? null)}
                      className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seasons */}
            {seasons.map((season, seasonIndex) => (
              <div key={seasonIndex} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-secondary/50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">Temporada {season.number}</span>
                    <input
                      type="text"
                      value={season.title}
                      onChange={(e) => updateSeason(seasonIndex, "title", e.target.value)}
                      className="px-3 py-1 bg-secondary border border-border rounded text-sm"
                      placeholder="Título (opcional)"
                    />
                  </div>
                  {seasons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSeason(seasonIndex)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Episodes */}
                <div className="p-4 space-y-4">
                  {season.episodes.map((episode, episodeIndex) => (
                    <div key={episodeIndex} className="p-4 bg-secondary/30 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Episodio {episode.number}</span>
                        {season.episodes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEpisode(seasonIndex, episodeIndex)}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={episode.title}
                          onChange={(e) => updateEpisode(seasonIndex, episodeIndex, "title", e.target.value)}
                          className="px-3 py-2 bg-secondary border border-border rounded text-sm"
                          placeholder="Título del episodio *"
                        />
                        <input
                          type="text"
                          value={episode.description}
                          onChange={(e) => updateEpisode(seasonIndex, episodeIndex, "description", e.target.value)}
                          className="px-3 py-2 bg-secondary border border-border rounded text-sm"
                          placeholder="Descripción (opcional)"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Video *</label>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => updateEpisode(seasonIndex, episodeIndex, "videoFile", e.target.files?.[0] ?? null)}
                            className="w-full text-xs"
                          />
                          {episode.videoFile && (
                            <p className="text-xs text-green-500 mt-1 truncate">✓ {episode.videoFile.name}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Miniatura</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => updateEpisode(seasonIndex, episodeIndex, "thumbnailFile", e.target.files?.[0] ?? null)}
                            className="w-full text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addEpisode(seasonIndex)}
                    className="w-full py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Episodio
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addSeason}
              className="w-full py-3 border border-dashed border-cyan-500/50 rounded-lg text-cyan-500 hover:bg-cyan-500/10 transition flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Agregar Temporada
            </button>

            {error && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/50 text-green-500 px-4 py-3 rounded-lg text-sm flex items-center">
                <Check className="h-5 w-5 mr-2" />
                ¡Serie creada! La conversión HLS se realiza en segundo plano.
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{uploadStatus}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || success}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <><Loader2 className="animate-spin mr-2 h-5 w-5" />Subiendo Serie...</>
              ) : success ? (
                <><Check className="mr-2 h-5 w-5" />Completado</>
              ) : (
                <><Upload className="mr-2 h-5 w-5" />Subir Serie</>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
