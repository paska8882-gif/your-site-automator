import { useCallback, useEffect, useState } from "react";

export type BackendHealthStatus = "checking" | "healthy" | "degraded";

interface Options {
  timeoutMs?: number;
  intervalMs?: number;
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

// Track failures outside of React state to avoid hook count changes
let consecutiveFailures = 0;

export function useBackendHealth(options: Options = {}) {
  const { timeoutMs = 10000, intervalMs = 30000 } = options;
  const [status, setStatus] = useState<BackendHealthStatus>("checking");
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);

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
      consecutiveFailures = 0;
      setStatus("healthy");
    } catch {
      consecutiveFailures++;
      // Only show degraded after 2+ consecutive failures
      if (consecutiveFailures >= 2) {
        setStatus("degraded");
        setLastErrorAt(Date.now());
      }
    }
  }, [timeoutMs]);

  useEffect(() => {
    check();
    const t = setInterval(check, intervalMs);
    return () => clearInterval(t);
  }, [check, intervalMs]);

  return { status, lastErrorAt, check };
}
