import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeTable } from "@/contexts/RealtimeContext";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: unknown;
  created_at: string;
}

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data || []) as Notification[];
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Realtime updates via centralized context
  const handleRealtimeUpdate = useCallback((event: { eventType: string; new: Record<string, unknown> | null }) => {
    if (event.eventType === "INSERT" && event.new) {
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (old = []) => [event.new as unknown as Notification, ...old]
      );
    }
  }, [queryClient, user?.id]);

  useRealtimeTable("notifications", handleRealtimeUpdate, [handleRealtimeUpdate]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    queryClient.setQueryData<Notification[]>(
      ["notifications", user?.id],
      (old = []) => old.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    queryClient.setQueryData<Notification[]>(
      ["notifications", user?.id],
      (old = []) => old.map((n) => ({ ...n, read: true }))
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
