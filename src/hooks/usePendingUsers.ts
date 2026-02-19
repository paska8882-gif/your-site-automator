import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useRealtimeTable } from "@/contexts/RealtimeContext";

export function usePendingUsers() {
  const [hasPendingUsers, setHasPendingUsers] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { isAdmin } = useAdmin();

  const fetchPendingUsers = async () => {
    if (!isAdmin) return;
    const { count, error } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (!error && count !== null) {
      setHasPendingUsers(count > 0);
      setPendingCount(count);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchPendingUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Use shared RealtimeContext channel instead of creating a dedicated one
  useRealtimeTable("team_members", () => {
    if (isAdmin) fetchPendingUsers();
  }, [isAdmin]);

  return { hasPendingUsers, pendingCount };
}
