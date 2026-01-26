import { useCallback, useRef } from "react";
import { useRealtime } from "@/contexts/RealtimeContext";

interface BalanceUpdate {
  teamId: string;
  oldBalance: number;
  newBalance: number;
}

type BalanceUpdateCallback = (update: BalanceUpdate) => void;

/**
 * Unified hook for team balance updates.
 * Components can register callbacks to be notified when any team's balance changes.
 * This prevents multiple components from creating separate realtime subscriptions.
 */
export function useTeamBalanceUpdates() {
  const { subscribe, isConnected } = useRealtime();
  const callbacksRef = useRef<Set<BalanceUpdateCallback>>(new Set());
  const prevBalancesRef = useRef<Map<string, number>>(new Map());

  // Register a callback to receive balance updates
  const onBalanceUpdate = useCallback((callback: BalanceUpdateCallback): (() => void) => {
    callbacksRef.current.add(callback);
    
    return () => {
      callbacksRef.current.delete(callback);
    };
  }, []);

  // Internal handler for team updates
  const handleTeamUpdate = useCallback((event: { 
    table: string; 
    eventType: string; 
    new: Record<string, unknown> | null;
  }) => {
    if (event.table !== "teams" || event.eventType !== "UPDATE" || !event.new) {
      return;
    }

    const teamId = event.new.id as string;
    const newBalance = event.new.balance as number;
    const oldBalance = prevBalancesRef.current.get(teamId) ?? newBalance;

    if (oldBalance !== newBalance) {
      prevBalancesRef.current.set(teamId, newBalance);
      
      const update: BalanceUpdate = {
        teamId,
        oldBalance,
        newBalance,
      };

      callbacksRef.current.forEach(cb => {
        try {
          cb(update);
        } catch (error) {
          console.error("[useTeamBalanceUpdates] Error in callback:", error);
        }
      });
    }
  }, []);

  // Subscribe to teams table updates
  const subscribeToTeams = useCallback(() => {
    return subscribe("teams", handleTeamUpdate);
  }, [subscribe, handleTeamUpdate]);

  // Set initial balance for tracking
  const setInitialBalance = useCallback((teamId: string, balance: number) => {
    prevBalancesRef.current.set(teamId, balance);
  }, []);

  return {
    onBalanceUpdate,
    subscribeToTeams,
    setInitialBalance,
    isConnected,
  };
}
