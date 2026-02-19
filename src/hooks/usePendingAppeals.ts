import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useRealtimeTable } from "@/contexts/RealtimeContext";

export function usePendingAppeals() {
  const [hasPendingAppeals, setHasPendingAppeals] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { isAdmin } = useAdmin();

  const fetchPendingAppeals = async () => {
    if (!isAdmin) return;
    const { count, error } = await supabase
      .from("appeals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (!error && count !== null) {
      setHasPendingAppeals(count > 0);
      setPendingCount(count);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchPendingAppeals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Use shared RealtimeContext channel instead of creating a dedicated one
  useRealtimeTable("appeals", () => {
    if (isAdmin) fetchPendingAppeals();
  }, [isAdmin]);

  return { hasPendingAppeals, pendingCount };
}
