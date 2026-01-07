import { useCallback, useEffect, useState } from "react";

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
  const { timeoutMs = 10000, intervalMs = 30000, failuresBeforeDegraded = 2 } = options;
  
  const [status, setStatus] = useState<BackendHealthStatus>("checking");
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
  const [failureCount, setFailureCount] = useState(0);

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
      setFailureCount(0);
      setStatus("healthy");
    } catch {
      // Increment failure count
      setFailureCount(prev => prev + 1);
    }
  }, [timeoutMs]);

  // Handle status change based on failure count
  useEffect(() => {
    if (failureCount >= failuresBeforeDegraded) {
      setStatus("degraded");
      setLastErrorAt(Date.now());
    }
  }, [failureCount, failuresBeforeDegraded]);

  useEffect(() => {
    check();
    const t = setInterval(check, intervalMs);
    return () => clearInterval(t);
  }, [check, intervalMs]);

  return { status, lastErrorAt, check };
}
