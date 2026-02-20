// @refresh reset
import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceData {
  enabled: boolean;
  message: string;
  support_link: string;
  generation_disabled: boolean;
  generation_message: string;
}

const DEFAULT_MAINTENANCE: MaintenanceData = {
  enabled: false,
  message: "Ведуться технічні роботи. Спробуйте пізніше.",
  support_link: "https://t.me/support",
  generation_disabled: false,
  generation_message: "Ведеться технічне обслуговування. Генерація тимчасово недоступна.",
};

const QUERY_KEY = ["maintenance_mode"];

async function fetchMaintenance(): Promise<MaintenanceData> {
  const { data, error } = await supabase
    .from("maintenance_mode")
    .select("enabled, message, support_link, generation_disabled, generation_message")
    .eq("id", "global")
    .maybeSingle();

  if (error) {
    console.error("Error fetching maintenance mode:", error);
    return DEFAULT_MAINTENANCE;
  }

  if (!data) return DEFAULT_MAINTENANCE;

  return {
    enabled: data.enabled,
    message: data.message || DEFAULT_MAINTENANCE.message,
    support_link: data.support_link || DEFAULT_MAINTENANCE.support_link,
    generation_disabled: data.generation_disabled ?? false,
    generation_message: data.generation_message || DEFAULT_MAINTENANCE.generation_message,
  };
}

/**
 * Consolidated maintenance hook. One query + one realtime channel shared across all consumers.
 * Replaces both useMaintenanceMode and useGenerationMaintenance.
 */
export function useMaintenanceMode() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMaintenance,
    staleTime: 10 * 60 * 1000, // 10 min - realtime handles updates
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Shared cache - no need to refetch on every mount
  });

  // Single realtime channel for all consumers
  useEffect(() => {
    const channel = supabase
      .channel("maintenance_mode_shared")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "maintenance_mode",
          filter: "id=eq.global",
        },
        (payload) => {
          const d = payload.new as Record<string, unknown>;
          queryClient.setQueryData<MaintenanceData>(QUERY_KEY, () => ({
            enabled: d.enabled as boolean,
            message: (d.message as string) || DEFAULT_MAINTENANCE.message,
            support_link: (d.support_link as string) || DEFAULT_MAINTENANCE.support_link,
            generation_disabled: (d.generation_disabled as boolean) ?? false,
            generation_message: (d.generation_message as string) || DEFAULT_MAINTENANCE.generation_message,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const maintenance = data ?? DEFAULT_MAINTENANCE;

  const setEnabled = useCallback((enabled: boolean) => {
    queryClient.setQueryData<MaintenanceData>(QUERY_KEY, (old) => ({
      ...(old ?? DEFAULT_MAINTENANCE),
      enabled,
    }));
  }, [queryClient]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  return {
    maintenance: {
      enabled: maintenance.enabled,
      message: maintenance.message,
      support_link: maintenance.support_link,
    },
    // Generation maintenance fields (replaces useGenerationMaintenance)
    generationDisabled: maintenance.generation_disabled,
    generationMessage: maintenance.generation_message,
    loading: isLoading,
    error: null as Error | null,
    setEnabled,
    refetch,
  };
}
