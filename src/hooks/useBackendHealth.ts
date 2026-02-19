import { useCallback, useEffect, useRef, useState } from "react";

export type BackendHealthStatus = "checking" | "healthy" | "degraded";

interface Options {
  initialTimeoutMs?: number;
  maxTimeoutMs?: number;
  baseIntervalMs?: number;
  maxRetries?: number;
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
    maxTimeoutMs = 60000,
    baseIntervalMs = 600000, // Default: 10 minutes — reduces DB pings significantly
    maxRetries = 5,
  } = options;

  const [state, setState] = useState<HealthState>({
    status: "checking",
    lastErrorAt: null,
    consecutiveFailures: 0,
    lastError: null,
    isRetrying: false,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Calculate exponential backoff delay
  const getBackoffDelay = useCallback((failures: number) => {
    // Exponential backoff: 2^failures * 1000ms, capped at maxTimeoutMs
    const delay = Math.min(Math.pow(2, failures) * 1000, maxTimeoutMs);
    return delay;
  }, [maxTimeoutMs]);

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

      // Read current state via ref to avoid stale closure / dep array issues
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
        const isDegraded = newFailures >= 3;

        logHealthEvent("health_check_failed", {
          error: errorMessage,
          isTimeout,
          consecutiveFailures: newFailures,
          isDegraded,
        });

        // Schedule automatic retry with exponential backoff
        if (newFailures < maxRetries) {
          const backoffDelay = getBackoffDelay(newFailures);
          logHealthEvent("scheduling_retry", {
            attempt: newFailures + 1,
            maxRetries,
            delayMs: backoffDelay,
          });

          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = setTimeout(() => check(false), backoffDelay);
        } else {
          logHealthEvent("max_retries_reached", { maxRetries });
        }

        return {
          status: isDegraded ? "degraded" : prev.status,
          lastErrorAt: isDegraded ? Date.now() : prev.lastErrorAt,
          consecutiveFailures: newFailures,
          lastError: errorMessage,
          isRetrying: false,
        };
      });
    }
  }, [initialTimeoutMs, maxRetries, getBackoffDelay]);

  // Manual retry function for user-triggered retries
  const retry = useCallback(() => {
    // Clear any pending automatic retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    // Reset failures and check immediately
    setState(prev => ({ ...prev, consecutiveFailures: 0 }));
    check(true);
  }, [check]);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(() => check(), baseIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
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
