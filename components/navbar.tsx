"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Film, Search, Settings } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ADMIN_CODE = "rizik";

export function Navbar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery?.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleAdminAccess = () => {
    if (adminCode === ADMIN_CODE) {
      // Guardar en localStorage que tiene acceso admin
      localStorage.setItem("adminAccess", "true");
      setShowAdminDialog(false);
      setAdminCode("");
      setError("");
      router.push("/admin");
    } else {
      setError("Código incorrecto");
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center space-x-2 group">
              <Film className="h-8 w-8 text-primary group-hover:scale-110 transition" />
              <span className="text-xl font-bold">WatchParty</span>
            </Link>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar videos..."
                  className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-primary transition"
                />
              </div>
            </form>

            {/* Admin Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdminDialog(true)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-5 w-5" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Admin Code Dialog */}
      <Dialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Acceso Administrador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Input
                type="password"
                placeholder="Ingresa el código de admin"
                value={adminCode}
                onChange={(e) => {
                  setAdminCode(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAdminAccess();
                  }
                }}
                className="text-center text-lg tracking-widest"
              />
              {error && (
                <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
              )}
            </div>
            <Button onClick={handleAdminAccess} className="w-full">
              Acceder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
