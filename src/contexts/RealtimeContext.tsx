import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/contexts/UserDataContext";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type EventType = "INSERT" | "UPDATE" | "DELETE";

interface RealtimeEvent {
  table: string;
  eventType: EventType;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

type RealtimeCallback = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  subscribe: (table: string, callback: RealtimeCallback) => () => void;
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

// Tables that users subscribe to
const USER_TABLES = ["generation_history", "teams", "notifications"] as const;

// Tables that admins also subscribe to
const ADMIN_TABLES = ["admin_tasks", "balance_requests", "appeals", "team_members"] as const;

type UserTable = typeof USER_TABLES[number];
type AdminTable = typeof ADMIN_TABLES[number];
type AllTables = UserTable | AdminTable;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = useUserData();
  const [isConnected, setIsConnected] = useState(false);
  
  const userChannelRef = useRef<RealtimeChannel | null>(null);
  const adminChannelRef = useRef<RealtimeChannel | null>(null);
  
  // Map of table -> Set of callbacks
  const subscribersRef = useRef<Map<string, Set<RealtimeCallback>>>(new Map());
  
  // Debounce mechanism to batch rapid events
  const eventQueueRef = useRef<RealtimeEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushEvents = useCallback(() => {
    const events = eventQueueRef.current;
    eventQueueRef.current = [];
    
    for (const event of events) {
      const callbacks = subscribersRef.current.get(event.table);
      if (callbacks) {
        callbacks.forEach(cb => {
          try {
            cb(event);
          } catch (error) {
            console.error(`[RealtimeContext] Error in callback for ${event.table}:`, error);
          }
        });
      }
    }
  }, []);

  const queueEvent = useCallback((event: RealtimeEvent) => {
    eventQueueRef.current.push(event);
    
    // Debounce: flush after 100ms of no new events
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    flushTimeoutRef.current = setTimeout(flushEvents, 100);
  }, [flushEvents]);

  const handlePayload = useCallback((
    table: string,
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => {
    const event: RealtimeEvent = {
      table,
      eventType: payload.eventType as EventType,
      new: payload.eventType !== "DELETE" ? payload.new : null,
      old: payload.eventType !== "INSERT" ? payload.old : null,
    };
    
    queueEvent(event);
  }, [queueEvent]);

  // Setup channels
  useEffect(() => {
    if (!user?.id) {
      setIsConnected(false);
      return;
    }

    console.log("[RealtimeContext] Setting up channels for user:", user.id, "isAdmin:", isAdmin);

    // User channel - consolidated subscriptions
    const userChannel = supabase
      .channel(`user-updates-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generation_history", filter: `user_id=eq.${user.id}` },
        (payload) => handlePayload("generation_history", payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => handlePayload("teams", payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => handlePayload("notifications", payload)
      )
      .subscribe((status, err) => {
        console.log("[RealtimeContext] User channel status:", status, err?.message);
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
        }
      });

    userChannelRef.current = userChannel;

    // Admin channel - additional subscriptions for admins
    if (isAdmin) {
      const adminChannel = supabase
        .channel(`admin-updates-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "admin_tasks" },
          (payload) => handlePayload("admin_tasks", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "balance_requests" },
          (payload) => handlePayload("balance_requests", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appeals" },
          (payload) => handlePayload("appeals", payload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "team_members" },
          (payload) => handlePayload("team_members", payload)
        )
        .subscribe((status, err) => {
          console.log("[RealtimeContext] Admin channel status:", status, err?.message);
        });

      adminChannelRef.current = adminChannel;
    }

    return () => {
      console.log("[RealtimeContext] Cleaning up channels");
      if (userChannelRef.current) {
        supabase.removeChannel(userChannelRef.current);
        userChannelRef.current = null;
      }
      if (adminChannelRef.current) {
        supabase.removeChannel(adminChannelRef.current);
        adminChannelRef.current = null;
      }
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      setIsConnected(false);
    };
  }, [user?.id, isAdmin, handlePayload]);

  // Subscribe function for components
  const subscribe = useCallback((table: string, callback: RealtimeCallback): (() => void) => {
    if (!subscribersRef.current.has(table)) {
      subscribersRef.current.set(table, new Set());
    }
    
    subscribersRef.current.get(table)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = subscribersRef.current.get(table);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscribersRef.current.delete(table);
        }
      }
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ subscribe, isConnected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
}

// Convenience hook for subscribing to a specific table
export function useRealtimeTable(
  table: AllTables,
  callback: RealtimeCallback,
  deps: React.DependencyList = []
) {
  const { subscribe } = useRealtime();
  
  useEffect(() => {
    const unsubscribe = subscribe(table, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, table, ...deps]);
}
