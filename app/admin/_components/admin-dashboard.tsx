"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Film, Upload, Settings, LogOut, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminDashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Admin Navbar */}
      <nav className="sticky top-0 z-50 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Film className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">WatchParty Admin</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="border-zinc-700">
                  <Home className="w-4 h-4 mr-2" />
                  Ver sitio
                </Button>
              </Link>
              <span className="text-sm text-zinc-400">Modo administrador</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Panel de Administración</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Card */}
          <Link href="/admin/upload">
            <Card className="bg-zinc-900 border-zinc-800 hover:border-primary/50 transition cursor-pointer h-full">
              <CardHeader>
                <div className="p-3 bg-green-500/10 rounded-lg w-fit">
                  <Upload className="w-8 h-8 text-green-500" />
                </div>
                <CardTitle className="text-white">Subir Contenido</CardTitle>
                <CardDescription className="text-zinc-400">
                  Añadir nuevas películas, documentales o series
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* Manage Card */}
          <Link href="/admin/manage">
            <Card className="bg-zinc-900 border-zinc-800 hover:border-primary/50 transition cursor-pointer h-full">
              <CardHeader>
                <div className="p-3 bg-blue-500/10 rounded-lg w-fit">
                  <Settings className="w-8 h-8 text-blue-500" />
                </div>
                <CardTitle className="text-white">Gestionar Contenido</CardTitle>
                <CardDescription className="text-zinc-400">
                  Editar, eliminar o ver estado de conversión
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

        </div>
      </div>
    </div>
  );
}
