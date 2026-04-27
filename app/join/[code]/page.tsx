"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Film, Users, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RoomInfo {
  id: string;
  code: string;
  name: string;
  video?: {
    id: string;
    title: string;
  };
  episode?: {
    id: string;
    title: string;
  };
  participants: Array<{ id: string; guestName: string }>;
}

export default function JoinRoomPage() {
  const params = useParams();
  const code = params.code as string;
  const [guestName, setGuestName] = useState("");
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!code) return;
    
    const fetchRoomInfo = async () => {
      try {
        // Try video room first
        let res = await fetch(`/api/rooms/${code}`);
        if (res.ok) {
          const data = await res.json();
          setRoomInfo(data);
        } else {
          // Try episode room
          res = await fetch(`/api/rooms/episode/${code}`);
          if (res.ok) {
            const data = await res.json();
            setRoomInfo(data);
          } else {
            setError("Room no encontrada o ya no está activa");
          }
        }
      } catch (err) {
        setError("Error al cargar información de la room");
      } finally {
        setLoading(false);
      }
    };

    fetchRoomInfo();
  }, [code]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError("Por favor ingresa tu nombre");
      return;
    }

    setJoining(true);
    setError("");

    try {
      // Determine if video or episode room
      const isEpisodeRoom = roomInfo?.episode;
      const endpoint = isEpisodeRoom ? "/api/rooms/episode/join" : "/api/rooms/join";
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, guestName: guestName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        // Store participant info in localStorage
        localStorage.setItem(`room_${code}_participant`, JSON.stringify({
          id: data.participantId,
          name: guestName.trim(),
        }));
        
        // Redirect to watch page
        if (isEpisodeRoom) {
          router.push(`/watch/episode/${data.episode.id}?room=${code}`);
        } else {
          router.push(`/watch/${data.video.id}?room=${code}`);
        }
      } else {
        const err = await res.json();
        setError(err.error || "Error al unirse a la room");
      }
    } catch (err) {
      setError("Error al unirse a la room");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !roomInfo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-red-400">Error</CardTitle>
            <CardDescription className="text-zinc-400">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push("/dashboard")} variant="outline">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Users className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white flex items-center justify-center gap-2">
            <Film className="w-6 h-6" />
            Unirse a Watch Party
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {roomInfo?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-400 mb-1">Contenido:</p>
            <p className="text-white font-medium">
              {roomInfo?.video?.title || roomInfo?.episode?.title}
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              {roomInfo?.participants?.length || 0} persona(s) en la room
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="name" className="text-zinc-300">Tu nombre</Label>
              <Input
                id="name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="¿Cómo te llamas?"
                className="bg-zinc-800 border-zinc-700 text-white"
                autoFocus
              />
            </div>
            
            <Button
              type="submit"
              disabled={joining}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {joining ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uniéndose...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Unirse a la Room
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
