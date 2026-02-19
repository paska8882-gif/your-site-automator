import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useRealtimeTable } from "@/contexts/RealtimeContext";

export function usePendingManualRequests() {
  const [hasPendingManualRequests, setHasPendingManualRequests] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { isAdmin } = useAdmin();

  const fetchPendingManualRequests = async () => {
    if (!isAdmin) return;
    const { count, error } = await supabase
      .from("generation_history")
      .select("id", { count: "exact", head: true })
      .eq("status", "manual_request");

    if (!error && count !== null) {
      setHasPendingManualRequests(count > 0);
      setPendingCount(count);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchPendingManualRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Use shared RealtimeContext channel instead of creating a dedicated one
  useRealtimeTable("generation_history", () => {
    if (isAdmin) fetchPendingManualRequests();
  }, [isAdmin]);

  return { hasPendingManualRequests, pendingCount };
}
