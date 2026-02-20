import { useCallback, useEffect, useRef, useState } from "react";

export type BackendHealthStatus = "checking" | "healthy" | "degraded";

interface Options {
  initialTimeoutMs?: number;
  baseIntervalMs?: number;
}

interface HealthState {
  status: BackendHealthStatus;
  lastErrorAt: number | null;
  consecutiveFailures: number;
  lastError: string | null;
  isRetrying: boolean;
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

function logHealthEvent(event: string, details: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, event, ...details };
  
  // Console logging
  if (details.error) {
    console.error(`[BackendHealth] ${event}:`, logEntry);
  } else {
    console.info(`[BackendHealth] ${event}:`, logEntry);
  }
  
  // Could be extended to send to analytics/tracking service
  // e.g., analytics.track('backend_health', logEntry);
}

export function useBackendHealth(options: Options = {}) {
  const {
    initialTimeoutMs = 10000,
    baseIntervalMs = 600000, // 10 minutes
  } = options;

  const [state, setState] = useState<HealthState>({
    status: "checking",
    lastErrorAt: null,
    consecutiveFailures: 0,
    lastError: null,
    isRetrying: false,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const check = useCallback(async (isManualRetry = false) => {
    if (isManualRetry) {
      setState(prev => ({ ...prev, isRetrying: true }));
      logHealthEvent("manual_retry_initiated", {});
    }

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`;
      await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            accept: "application/json",
          },
        },
        initialTimeoutMs
      );

      const currentState = stateRef.current;
      if (currentState.consecutiveFailures > 0) {
        logHealthEvent("backend_recovered", {
          previousFailures: currentState.consecutiveFailures,
          downtime: currentState.lastErrorAt ? Date.now() - currentState.lastErrorAt : null,
        });
      }

      setState({
        status: "healthy",
        lastErrorAt: null,
        consecutiveFailures: 0,
        lastError: null,
        isRetrying: false,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isTimeout = error instanceof Error && error.name === "AbortError";

      setState(prev => {
        const newFailures = prev.consecutiveFailures + 1;
        const isDegraded = newFailures >= 1; // Degraded on first failure, no auto-retry

        logHealthEvent("health_check_failed", {
          error: errorMessage,
          isTimeout,
          consecutiveFailures: newFailures,
          isDegraded,
        });

        return {
          status: isDegraded ? "degraded" : prev.status,
          lastErrorAt: Date.now(),
          consecutiveFailures: newFailures,
          lastError: errorMessage,
          isRetrying: false,
        };
      });
    }
  }, [initialTimeoutMs]);

  // Manual retry only — no automatic retries
  const retry = useCallback(() => {
    setState(prev => ({ ...prev, consecutiveFailures: 0 }));
    check(true);
  }, [check]);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(() => check(), baseIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check, baseIntervalMs]);

  return {
    status: state.status,
    lastErrorAt: state.lastErrorAt,
    lastError: state.lastError,
    consecutiveFailures: state.consecutiveFailures,
    isRetrying: state.isRetrying,
    check: () => check(false),
    retry,
  };
}
