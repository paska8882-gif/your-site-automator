import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";

export function usePendingManualRequests() {
  const [hasPendingManualRequests, setHasPendingManualRequests] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!isAdmin) return;

    const fetchPendingManualRequests = async () => {
      const { count, error } = await supabase
        .from("generation_history")
        .select("id", { count: "exact", head: true })
        .eq("status", "manual_request");

      if (!error && count !== null) {
        setHasPendingManualRequests(count > 0);
        setPendingCount(count);
      }
    };

    fetchPendingManualRequests();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("pending-manual-requests-indicator")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_history",
        },
        () => {
          fetchPendingManualRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  return { hasPendingManualRequests, pendingCount };
}
