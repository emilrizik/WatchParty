"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadClient } from "./_components/upload-client";

export default function AdminUploadPage() {
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

  if (!mounted || !hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return <UploadClient />;
}
