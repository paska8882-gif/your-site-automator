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
      // Use a simple health check that doesn't require RLS access
      // Just ping the Supabase REST endpoint to check connectivity
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`;
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

      // Any response (even 404) means the backend is reachable
      consecutiveFailures = 0;
      setStatus("healthy");
    } catch (error) {
      // Only count as failure if it's a network/timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        consecutiveFailures++;
      } else {
        // For other fetch errors, increment failure count
        consecutiveFailures++;
      }
      
      // Only show degraded after 3+ consecutive failures to reduce false positives
      if (consecutiveFailures >= 3) {
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
