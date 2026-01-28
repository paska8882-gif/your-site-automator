import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceMode {
  enabled: boolean;
  message: string;
  support_link: string;
}

export function useMaintenanceMode() {
  const [maintenance, setMaintenance] = useState<MaintenanceMode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaintenance = async () => {
      const { data, error } = await supabase
        .from("maintenance_mode")
        .select("enabled, message, support_link")
        .eq("id", "global")
        .maybeSingle();

      if (!error && data) {
        setMaintenance(data);
      }
      setLoading(false);
    };

    fetchMaintenance();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("maintenance_mode_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "maintenance_mode",
          filter: "id=eq.global",
        },
        (payload) => {
          const newData = payload.new as MaintenanceMode & { id: string };
          setMaintenance({
            enabled: newData.enabled,
            message: newData.message,
            support_link: newData.support_link,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { maintenance, loading };
}
