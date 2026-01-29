import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";

export function usePendingUsers() {
  const [hasPendingUsers, setHasPendingUsers] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!isAdmin) return;

    const fetchPendingUsers = async () => {
      const { count, error } = await supabase
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (!error && count !== null) {
        setHasPendingUsers(count > 0);
        setPendingCount(count);
      }
    };

    fetchPendingUsers();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("pending-users-indicator")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_members",
        },
        () => {
          fetchPendingUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  return { hasPendingUsers, pendingCount };
}
