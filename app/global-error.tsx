"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "error",
        type: "global_error_boundary",
        message: error.message,
        stack: error.stack ?? null,
        href: typeof window !== "undefined" ? window.location.href : "",
        digest: error.digest ?? null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-red-800 bg-zinc-950 p-6 space-y-4">
          <h1 className="text-xl font-semibold text-red-400">
            Error en la aplicación
          </h1>
          <p className="text-sm text-zinc-300">
            Se registró el error en el servidor. Intenta recargar esta vista.
          </p>
          <button
            onClick={() => reset()}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
