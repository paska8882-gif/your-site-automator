import { useState, useEffect, useCallback, useRef } from "react";

interface AutoRetryState {
  itemId: string;
  countdown: number;
  isActive: boolean;
}

interface UseAutoRetryOptions {
  autoRetryDelay?: number; // seconds before auto-retry
  onRetry: (itemId: string) => Promise<void>;
}

export function useAutoRetry({ autoRetryDelay = 30, onRetry }: UseAutoRetryOptions) {
  const [retryStates, setRetryStates] = useState<Record<string, AutoRetryState>>({});
  const [cancelledItems, setCancelledItems] = useState<Set<string>>(new Set());
  const [retryingItems, setRetryingItems] = useState<Set<string>>(new Set());
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Start countdown for a failed item
  const startAutoRetry = useCallback((itemId: string) => {
    // Don't start if already cancelled or retrying
    if (cancelledItems.has(itemId) || retryingItems.has(itemId)) return;

    // Clear existing interval if any
    if (intervalsRef.current[itemId]) {
      clearInterval(intervalsRef.current[itemId]);
    }

    setRetryStates(prev => ({
      ...prev,
      [itemId]: {
        itemId,
        countdown: autoRetryDelay,
        isActive: true,
      }
    }));

    intervalsRef.current[itemId] = setInterval(() => {
      setRetryStates(prev => {
        const state = prev[itemId];
        if (!state || !state.isActive) {
          clearInterval(intervalsRef.current[itemId]);
          return prev;
        }

        const newCountdown = state.countdown - 1;
        
        if (newCountdown <= 0) {
          clearInterval(intervalsRef.current[itemId]);
          // Trigger retry
          triggerRetry(itemId);
          return {
            ...prev,
            [itemId]: { ...state, countdown: 0, isActive: false }
          };
        }

        return {
          ...prev,
          [itemId]: { ...state, countdown: newCountdown }
        };
      });
    }, 1000);
  }, [autoRetryDelay, cancelledItems, retryingItems]);

  // Cancel auto-retry for an item
  const cancelAutoRetry = useCallback((itemId: string) => {
    if (intervalsRef.current[itemId]) {
      clearInterval(intervalsRef.current[itemId]);
      delete intervalsRef.current[itemId];
    }
    
    setCancelledItems(prev => new Set(prev).add(itemId));
    setRetryStates(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
  }, []);

  // Trigger retry (manual or auto)
  const triggerRetry = useCallback(async (itemId: string) => {
    // Clean up countdown
    if (intervalsRef.current[itemId]) {
      clearInterval(intervalsRef.current[itemId]);
      delete intervalsRef.current[itemId];
    }

    setRetryStates(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });

    setRetryingItems(prev => new Set(prev).add(itemId));

    try {
      await onRetry(itemId);
    } finally {
      setRetryingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }, [onRetry]);

  // Manual retry (resets cancelled state)
  const manualRetry = useCallback(async (itemId: string) => {
    setCancelledItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
    await triggerRetry(itemId);
  }, [triggerRetry]);

  // Get retry state for an item
  const getRetryState = useCallback((itemId: string) => {
    return {
      countdown: retryStates[itemId]?.countdown ?? 0,
      isActive: retryStates[itemId]?.isActive ?? false,
      isCancelled: cancelledItems.has(itemId),
      isRetrying: retryingItems.has(itemId),
    };
  }, [retryStates, cancelledItems, retryingItems]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach(clearInterval);
    };
  }, []);

  return {
    startAutoRetry,
    cancelAutoRetry,
    manualRetry,
    getRetryState,
  };
}
