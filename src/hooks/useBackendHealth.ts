import { useCallback, useEffect, useState, useRef } from "react";

export type BackendHealthStatus = "checking" | "healthy" | "degraded";

interface Options {
  timeoutMs?: number;
  intervalMs?: number;
  failuresBeforeDegraded?: number;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export function useBackendHealth(options: Options = {}) {
  // Increased timeout to 10 seconds, require 2 consecutive failures before showing degraded
  const { timeoutMs = 10000, intervalMs = 30000, failuresBeforeDegraded = 2 } = options;
  const [status, setStatus] = useState<BackendHealthStatus>("checking");
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
  const consecutiveFailures = useRef(0);

  const check = useCallback(async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/teams?select=id&limit=1`;
      const res = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            accept: "application/json",
          },
        },
        timeoutMs
      );

      if (!res.ok) throw new Error(`healthcheck ${res.status}`);
      
      // Success - reset failures and set healthy
      consecutiveFailures.current = 0;
      setStatus("healthy");
    } catch {
      consecutiveFailures.current += 1;
      
      // Only show degraded after multiple consecutive failures
      if (consecutiveFailures.current >= failuresBeforeDegraded) {
        setStatus("degraded");
        setLastErrorAt(Date.now());
      }
    }
  }, [timeoutMs, failuresBeforeDegraded]);

  useEffect(() => {
    check();
    const t = setInterval(check, intervalMs);
    return () => clearInterval(t);
  }, [check, intervalMs]);

  return { status, lastErrorAt, check };
}
