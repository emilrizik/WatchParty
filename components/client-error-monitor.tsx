"use client";

import { useEffect } from "react";

type ClientLogLevel = "error" | "warn" | "info";

interface ClientLogPayload {
  level: ClientLogLevel;
  type: string;
  message: string;
  stack?: string | null;
  source?: string | null;
  line?: number | null;
  column?: number | null;
  href?: string;
  userAgent?: string;
}

function sendClientLog(payload: ClientLogPayload) {
  try {
    fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore client logging failures
  }
}

export function ClientErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      sendClientLog({
        level: "error",
        type: "window_error",
        message: event.message || "Unknown client error",
        stack: event.error?.stack ?? null,
        source: event.filename ?? null,
        line: event.lineno ?? null,
        column: event.colno ?? null,
        href: window.location.href,
        userAgent: navigator.userAgent,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason?.message || JSON.stringify(event.reason);

      sendClientLog({
        level: "error",
        type: "unhandled_rejection",
        message: reason || "Unhandled promise rejection",
        stack: event.reason?.stack ?? null,
        href: window.location.href,
        userAgent: navigator.userAgent,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
