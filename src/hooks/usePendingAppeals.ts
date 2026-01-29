import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";

export function usePendingAppeals() {
  const [hasPendingAppeals, setHasPendingAppeals] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!isAdmin) return;

    const fetchPendingAppeals = async () => {
      const { count, error } = await supabase
        .from("appeals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (!error && count !== null) {
        setHasPendingAppeals(count > 0);
        setPendingCount(count);
      }
    };

    fetchPendingAppeals();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("pending-appeals-indicator")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appeals",
        },
        () => {
          fetchPendingAppeals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  return { hasPendingAppeals, pendingCount };
}
