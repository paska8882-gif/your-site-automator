import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceMode {
  enabled: boolean;
  message: string;
  support_link: string;
}

const DEFAULT_MAINTENANCE: MaintenanceMode = {
  enabled: false,
  message: "Ведуться технічні роботи. Спробуйте пізніше.",
  support_link: "https://t.me/support",
};

export function useMaintenanceMode() {
  const [state, setState] = useState<{
    maintenance: MaintenanceMode;
    loading: boolean;
    error: Error | null;
  }>({
    maintenance: DEFAULT_MAINTENANCE,
    loading: true,
    error: null,
  });

  const fetchMaintenance = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("maintenance_mode")
        .select("enabled, message, support_link")
        .eq("id", "global")
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching maintenance mode:", fetchError);
        setState(prev => ({ ...prev, error: new Error(fetchError.message) }));
        return;
      }

      if (data) {
        setState(prev => ({
          ...prev,
          maintenance: {
            enabled: data.enabled,
            message: data.message || DEFAULT_MAINTENANCE.message,
            support_link: data.support_link || DEFAULT_MAINTENANCE.support_link,
          },
          error: null,
        }));
      }
    } catch (err) {
      console.error("Error in fetchMaintenance:", err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error("Unknown error"),
      }));
    }
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({
      ...prev,
      maintenance: { ...prev.maintenance, enabled },
    }));
  }, []);

  const refetch = useCallback(async () => {
    await fetchMaintenance();
  }, [fetchMaintenance]);

  useEffect(() => {
    const init = async () => {
      await fetchMaintenance();
      setState(prev => ({ ...prev, loading: false }));
    };

    init();

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
          setState(prev => ({
            ...prev,
            maintenance: {
              enabled: newData.enabled,
              message: newData.message || DEFAULT_MAINTENANCE.message,
              support_link: newData.support_link || DEFAULT_MAINTENANCE.support_link,
            },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMaintenance]);

  return {
    maintenance: state.maintenance,
    loading: state.loading,
    error: state.error,
    setEnabled,
    refetch,
  };
}
