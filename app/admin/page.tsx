"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Film, Upload, Settings, LogOut, Home, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminPage() {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const access = localStorage.getItem("adminAccess");
    if (access === "true") {
      setHasAccess(true);
    } else {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("adminAccess");
    router.push("/dashboard");
  };

  if (!mounted || !hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Navbar */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <Film className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">WatchParty</span>
              <span className="ml-2 px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
                Admin
              </span>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Home className="h-4 w-4" />
                  Ver sitio
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Admin Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Panel de Administración</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Content */}
          <Link href="/admin/upload">
            <Card className="hover:border-green-500 transition-colors cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-green-500/20">
                    <Upload className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <CardTitle>Subir Contenido</CardTitle>
                    <CardDescription>
                      Agregar películas o series
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>

          {/* Manage Content */}
          <Link href="/admin/manage">
            <Card className="hover:border-blue-500 transition-colors cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-500/20">
                    <Settings className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle>Gestionar Contenido</CardTitle>
                    <CardDescription>
                      Editar, eliminar o ver estado
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
