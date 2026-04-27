"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  Play,
  Pause,
  Users,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  MessageCircle,
  SkipForward,
  SkipBack,
  Share2,
} from "lucide-react";
import Hls from "hls.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  readStoredParticipant,
  removeStoredParticipant,
  writeStoredParticipant,
} from "@/lib/client-storage";

interface Episode {
  id: string;
  number: number;
  title: string;
  description?: string | null;
  videoUrl: string;
  hlsPath?: string | null;
  hlsStatus: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  season: {
    id: string;
    number: number;
    series: {
      id: string;
      title: string;
    };
    episodes: Array<{
      id: string;
      number: number;
      title: string;
    }>;
  };
}

interface Room {
  id: string;
  code: string;
  name: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdatedAt: string;
  lastUpdatedBy?: string | null;
  episodeId: string;
  episode?: Episode;
  participants: Array<{
    id: string;
    guestName: string;
  }>;
}

interface ChatMessage {
  id: string;
  message: string;
  createdAt: string;
  guestName: string;
}

interface EpisodeWatchClientProps {
  episodeId: string;
}

export function EpisodeWatchClient({ episodeId }: EpisodeWatchClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncTimeRef = useRef<number>(0);
  const isUserActionRef = useRef(false);

  // Guest info
  const [guestName, setGuestName] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameInputValue, setNameInputValue] = useState("");
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);

  // Chat state - floating bubble
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageTimeRef = useRef<string | null>(null);

  // Check for room code in URL params
  useEffect(() => {
    const roomParam = searchParams.get("room");
    if (roomParam) {
      const storedParticipant = readStoredParticipant(roomParam);
      if (storedParticipant) {
        setParticipantId(storedParticipant.id);
        setGuestName(storedParticipant.name);
        // Auto-join the room
        fetchRoomAndJoin(roomParam);
      }
    }
  }, [searchParams]);

  const fetchRoomAndJoin = async (code: string) => {
    try {
      const res = await fetch(`/api/rooms/episode/${code}`);
      if (res.ok) {
        const roomData: Room = await res.json();
        setRoom(roomData);
        // If room is on different episode, navigate to it
        if (roomData.episodeId !== episodeId) {
          router.replace(`/watch/episode/${roomData.episodeId}?room=${code}`);
        }
      }
    } catch (err) {
      console.error("Error fetching room:", err);
    }
  };

  useEffect(() => {
    fetchEpisode();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [episodeId]);

  // Leave room on unmount (only if navigating away completely)
  useEffect(() => {
    return () => {
      // Don't leave if just changing episodes within room
    };
  }, []);

  useEffect(() => {
    if (room) {
      const pollInterval = setInterval(() => {
        syncRoomState();
      }, 1500);
      return () => clearInterval(pollInterval);
    }
  }, [room, episodeId]);

  // Poll chat messages
  useEffect(() => {
    if (room) {
      fetchMessages();
      const chatInterval = setInterval(fetchMessages, 2000);
      return () => clearInterval(chatInterval);
    } else {
      setMessages([]);
      lastMessageTimeRef.current = null;
    }
  }, [room]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current && chatOpen) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, chatOpen]);

  // Setup HLS player
  useEffect(() => {
    if (!episode || !videoRef.current) return;

    const video = videoRef.current;
    const src = episode.hlsPath && episode.hlsStatus === "completed" ? episode.hlsPath : episode.videoUrl;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (src.includes(".m3u8") && Hls.isSupported()) {
      hlsRef.current = new Hls();
      hlsRef.current.loadSource(src);
      hlsRef.current.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      video.src = episode.videoUrl;
    }
  }, [episode]);

  const fetchMessages = async () => {
    if (!room) return;
    try {
      const url = lastMessageTimeRef.current
        ? `/api/rooms/episode/${room.code}/messages?after=${encodeURIComponent(lastMessageTimeRef.current)}`
        : `/api/rooms/episode/${room.code}/messages`;

      const res = await fetch(url);
      if (!res.ok) return;

      const newMessages: ChatMessage[] = await res.json();

      if (newMessages.length > 0) {
        if (lastMessageTimeRef.current) {
          setMessages(prev => [...prev, ...newMessages]);
          // Count unread if chat is closed
          if (!chatOpen) {
            setUnreadCount(prev => prev + newMessages.length);
          }
        } else {
          setMessages(newMessages);
        }
        lastMessageTimeRef.current = newMessages[newMessages.length - 1].createdAt;
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const res = await fetch(`/api/rooms/episode/${room.code}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim(), guestName }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        lastMessageTimeRef.current = msg.createdAt;
        setNewMessage("");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSendingMessage(false);
    }
  };

  const fetchEpisode = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/episodes/${episodeId}`);
      if (!res.ok) {
        throw new Error("Episodio no encontrado");
      }
      const data = await res.json();
      setEpisode(data);
    } catch (err: any) {
      console.error("Error fetching episode:", err);
      setError(err?.message ?? "Error al cargar el episodio");
    } finally {
      setLoading(false);
    }
  };

  const syncRoomState = async () => {
    if (!room || isSyncing) return;

    try {
      const res = await fetch(`/api/rooms/episode/${room.code}`);
      if (!res.ok) return;

      const updatedRoom: Room = await res.json();
      const serverUpdateTime = new Date(updatedRoom.lastUpdatedAt).getTime();

      // Check if episode changed
      if (updatedRoom.episodeId !== episodeId) {
        // Navigate to new episode maintaining room
        router.replace(`/watch/episode/${updatedRoom.episodeId}?room=${room.code}`);
        return;
      }

      if (
        updatedRoom.lastUpdatedBy !== participantId &&
        serverUpdateTime > lastSyncTimeRef.current
      ) {
        setIsSyncing(true);

        if (videoRef.current) {
          const timeDiff = Math.abs(
            videoRef.current.currentTime - updatedRoom.currentTime
          );

          if (timeDiff > 2) {
            videoRef.current.currentTime = updatedRoom.currentTime;
          }

          if (updatedRoom.isPlaying && videoRef.current.paused) {
            videoRef.current.play()?.catch(console.error);
          } else if (!updatedRoom.isPlaying && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }

        setRoom(updatedRoom);
        lastSyncTimeRef.current = serverUpdateTime;
        setTimeout(() => setIsSyncing(false), 300);
      } else {
        setRoom(updatedRoom);
      }
    } catch (err) {
      console.error("Error syncing room state:", err);
    }
  };

  const updateRoomState = async (isPlaying: boolean, currentTime: number, newEpisodeId?: string) => {
    if (!room) return;

    try {
      isUserActionRef.current = true;

      await fetch("/api/rooms/episode/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: room.code,
          isPlaying,
          currentTime,
          participantId,
          episodeId: newEpisodeId,
        }),
      });

      lastSyncTimeRef.current = Date.now();

      // If episode changed, navigate
      if (newEpisodeId && newEpisodeId !== episodeId) {
        router.replace(`/watch/episode/${newEpisodeId}?room=${room.code}`);
      }
    } catch (err) {
      console.error("Error updating room state:", err);
    } finally {
      isUserActionRef.current = false;
    }
  };

  const handleCreateOrJoin = (action: "create" | "join") => {
    setPendingAction(action);
    setShowNameDialog(true);
  };

  const confirmName = async () => {
    const name = nameInputValue.trim() || "Invitado";
    setGuestName(name);
    setShowNameDialog(false);

    if (pendingAction === "create") {
      await createRoom(name);
    } else if (pendingAction === "join") {
      await joinRoom(roomCode, name);
    }

    setPendingAction(null);
    setNameInputValue("");
  };

  const createRoom = async (name: string) => {
    try {
      const res = await fetch("/api/rooms/episode/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId,
          name: `${episode?.season.series.title} - S${episode?.season.number}E${episode?.number}`,
          guestName: name,
        }),
      });

      if (!res.ok) {
        throw new Error("Error al crear sala");
      }

      const roomData = await res.json();
      setParticipantId(roomData.participantId);
      
      // Store in localStorage
      writeStoredParticipant(roomData.code, {
        id: roomData.participantId,
        name,
      });

      const detailsRes = await fetch(`/api/rooms/episode/${roomData.code}`);
      if (detailsRes.ok) {
        const fullRoom: Room = await detailsRes.json();
        setRoom(fullRoom);
        lastSyncTimeRef.current = new Date(fullRoom.lastUpdatedAt).getTime();
        
        // Update URL with room code
        router.replace(`/watch/episode/${episodeId}?room=${roomData.code}`);
      }
    } catch (err: any) {
      console.error("Error creating room:", err);
      setError(err?.message ?? "Error al crear sala");
    }
  };

  const joinRoom = async (code: string, name: string) => {
    try {
      const res = await fetch("/api/rooms/episode/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, guestName: name }),
      });

      if (!res.ok) {
        throw new Error("Sala no encontrada");
      }

      const joinData = await res.json();
      setParticipantId(joinData.participantId);
      
      // Store in localStorage
      writeStoredParticipant(code, {
        id: joinData.participantId,
        name,
      });

      const detailsRes = await fetch(`/api/rooms/episode/${code.toUpperCase()}`);
      if (detailsRes.ok) {
        const roomData: Room = await detailsRes.json();
        setRoom(roomData);

        // If room is on different episode, navigate
        if (roomData.episodeId !== episodeId) {
          router.replace(`/watch/episode/${roomData.episodeId}?room=${code}`);
          return;
        }

        if (videoRef.current) {
          videoRef.current.currentTime = roomData.currentTime ?? 0;
          if (roomData.isPlaying) {
            videoRef.current.play()?.catch(console.error);
          }
        }

        lastSyncTimeRef.current = new Date(roomData.lastUpdatedAt).getTime();
      }
    } catch (err: any) {
      console.error("Error joining room:", err);
      setError(err?.message ?? "Error al unirse a la sala");
    }
  };

  const leaveRoom = async () => {
    if (!room || !participantId) return;

    try {
      await fetch(`/api/rooms/episode/${room.code}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });

      removeStoredParticipant(room.code);
      setRoom(null);
      setParticipantId(null);
      setGuestName("");
      setChatOpen(false);
      router.replace(`/watch/episode/${episodeId}`);
    } catch (err) {
      console.error("Error leaving room:", err);
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current || isSyncing) return;

    const video = videoRef.current;
    const isPlaying = !video.paused;

    if (isPlaying) {
      video.pause();
    } else {
      video.play()?.catch(console.error);
    }

    if (room) {
      updateRoomState(!isPlaying, video.currentTime);
    }
  };

  const handleSeeked = () => {
    if (!videoRef.current || isSyncing || !room) return;
    updateRoomState(!videoRef.current.paused, videoRef.current.currentTime);
  };

  const skipForward = () => {
    if (!videoRef.current) return;
    const newTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration || 0);
    videoRef.current.currentTime = newTime;
    if (room) {
      updateRoomState(!videoRef.current.paused, newTime);
    }
  };

  const skipBackward = () => {
    if (!videoRef.current) return;
    const newTime = Math.max(videoRef.current.currentTime - 10, 0);
    videoRef.current.currentTime = newTime;
    if (room) {
      updateRoomState(!videoRef.current.paused, newTime);
    }
  };

  const copyRoomCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareRoom = () => {
    if (!room) return;
    const shareUrl = `${window.location.origin}/join/${room.code}`;
    if (navigator.share) {
      navigator.share({
        title: room.name,
        text: "¡Únete a mi Watch Party!",
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const navigateToEpisode = (newEpisodeId: string) => {
    if (room) {
      // Sync episode change to room
      updateRoomState(false, 0, newEpisodeId);
    } else {
      router.push(`/watch/episode/${newEpisodeId}`);
    }
  };

  const getAdjacentEpisodes = () => {
    if (!episode) return { prev: null, next: null };
    const episodes = episode.season.episodes.sort((a, b) => a.number - b.number);
    const currentIndex = episodes.findIndex((e) => e.id === episode.id);
    return {
      prev: currentIndex > 0 ? episodes[currentIndex - 1] : null,
      next: currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null,
    };
  };

  const { prev, next } = getAdjacentEpisodes();

  const openChat = () => {
    setChatOpen(true);
    setUnreadCount(0);
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

  if (error || !episode) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-6 flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-destructive">{error || "Episodio no encontrado"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-6">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
              <video
                ref={videoRef}
                controls
                className="w-full h-full"
                onSeeked={handleSeeked}
                onPlay={() => {
                  if (!isSyncing && room && !isUserActionRef.current) {
                    updateRoomState(true, videoRef.current?.currentTime ?? 0);
                  }
                }}
                onPause={() => {
                  if (!isSyncing && room && !isUserActionRef.current) {
                    updateRoomState(false, videoRef.current?.currentTime ?? 0);
                  }
                }}
              />
              {episode.hlsStatus === "completed" && (
                <div className="absolute top-4 left-4 px-2 py-1 bg-green-500 text-white text-xs rounded">
                  HLS Streaming
                </div>
              )}
            </div>

            {/* Episode Info */}
            <div>
              <Link
                href={`/series/${episode.season.series.id}`}
                className="text-primary hover:underline text-sm mb-2 inline-block"
              >
                ← {episode.season.series.title}
              </Link>
              <h1 className="text-2xl font-bold mb-1">
                S{episode.season.number}:E{episode.number} - {episode.title}
              </h1>
              {episode.description && (
                <p className="text-muted-foreground">{episode.description}</p>
              )}
            </div>

            {/* Episode Navigation - synced in room */}
            <div className="flex justify-between">
              {prev ? (
                <button
                  onClick={() => navigateToEpisode(prev.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Anterior</span>
                </button>
              ) : (
                <div />
              )}
              {next && (
                <button
                  onClick={() => navigateToEpisode(next.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Room Panel */}
          <div className="space-y-4">
            {room ? (
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Sala Activa
                  </h2>
                  <button
                    onClick={leaveRoom}
                    className="p-2 hover:bg-secondary rounded-full transition"
                    title="Salir de la sala"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <code className="flex-1 px-3 py-2 bg-secondary rounded font-mono text-center">
                    {room.code}
                  </code>
                  <button
                    onClick={copyRoomCode}
                    className="p-2 hover:bg-secondary rounded transition"
                    title="Copiar código"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={shareRoom}
                    className="p-2 hover:bg-secondary rounded transition"
                    title="Compartir enlace"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Sync Controls */}
                <div className="flex items-center justify-center gap-2 py-2">
                  <button
                    onClick={skipBackward}
                    className="p-2 bg-secondary hover:bg-secondary/80 rounded-full transition"
                    title="Retroceder 10s"
                  >
                    <SkipBack className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="p-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition"
                  >
                    {videoRef.current?.paused ? (
                      <Play className="h-6 w-6" />
                    ) : (
                      <Pause className="h-6 w-6" />
                    )}
                  </button>
                  <button
                    onClick={skipForward}
                    className="p-2 bg-secondary hover:bg-secondary/80 rounded-full transition"
                    title="Adelantar 10s"
                  >
                    <SkipForward className="h-5 w-5" />
                  </button>
                </div>

                {/* Participants */}
                <div className="flex flex-wrap gap-2">
                  {room.participants?.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center space-x-1 px-2 py-1 bg-secondary rounded text-xs"
                    >
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                      <span>{p.guestName || "Invitado"}</span>
                    </div>
                  ))}
                </div>

                {isSyncing && (
                  <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Sincronizando...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <h2 className="text-xl font-semibold flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Ver con Amigos
                </h2>
                <p className="text-sm text-muted-foreground">
                  Crea una sala o únete a una existente para ver sincronizados
                </p>

                <button
                  onClick={() => handleCreateOrJoin("create")}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition"
                >
                  Crear Sala
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-muted-foreground">o</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="CÓDIGO DE SALA"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition text-center font-mono text-lg"
                    maxLength={8}
                  />
                  <button
                    onClick={() => handleCreateOrJoin("join")}
                    disabled={!roomCode}
                    className="w-full bg-secondary hover:bg-secondary/80 font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Unirse a Sala
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating Chat Bubble */}
      {room && (
        <>
          {/* Chat bubble button */}
          {!chatOpen && (
            <button
              onClick={openChat}
              className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover:bg-primary/90 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-50"
            >
              <MessageCircle className="h-6 w-6 text-primary-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Chat panel */}
          {chatOpen && (
            <div className="fixed bottom-6 right-6 w-80 h-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50">
              {/* Header */}
              <div className="px-4 py-3 bg-primary flex items-center justify-between">
                <div className="flex items-center text-primary-foreground">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  <span className="font-semibold">Chat</span>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition"
                >
                  <X className="h-4 w-4 text-primary-foreground" />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-2"
              >
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    Envía el primer mensaje 👋
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] ${
                        msg.guestName === guestName
                          ? "bg-primary text-primary-foreground ml-auto rounded-br-sm"
                          : "bg-secondary rounded-bl-sm"
                      }`}
                    >
                      {msg.guestName !== guestName && (
                        <p className="font-medium text-xs text-muted-foreground mb-1">
                          {msg.guestName}
                        </p>
                      )}
                      <p className="break-words">{msg.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} className="p-2 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe algo..."
                    className="flex-1 px-3 py-2 bg-secondary border-0 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className="p-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition disabled:opacity-50"
                  >
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cómo te llamas?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Tu nombre"
              value={nameInputValue}
              onChange={(e) => setNameInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  confirmName();
                }
              }}
              className="text-center"
            />
            <Button onClick={confirmName} className="w-full">
              {pendingAction === "create" ? "Crear Sala" : "Unirse"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
