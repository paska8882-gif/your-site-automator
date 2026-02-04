import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GenerationMaintenanceState {
  generationDisabled: boolean;
  generationMessage: string;
  loading: boolean;
  error: Error | null;
}

const DEFAULT_STATE: GenerationMaintenanceState = {
  generationDisabled: false,
  generationMessage: "Ведеться технічне обслуговування. Генерація тимчасово недоступна.",
  loading: true,
  error: null,
};

export function useGenerationMaintenance() {
  const [state, setState] = useState<GenerationMaintenanceState>(DEFAULT_STATE);

  const fetchMaintenanceStatus = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("maintenance_mode")
        .select("generation_disabled, generation_message")
        .eq("id", "global")
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching generation maintenance status:", fetchError);
        setState(prev => ({ ...prev, error: new Error(fetchError.message), loading: false }));
        return;
      }

      if (data) {
        setState({
          generationDisabled: data.generation_disabled ?? false,
          generationMessage: data.generation_message || DEFAULT_STATE.generationMessage,
          loading: false,
          error: null,
        });
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error("Error in fetchMaintenanceStatus:", err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error("Unknown error"),
      }));
    }
  }, []);

  useEffect(() => {
    fetchMaintenanceStatus();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("generation_maintenance_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "maintenance_mode",
          filter: "id=eq.global",
        },
        (payload) => {
          const newData = payload.new as { 
            generation_disabled?: boolean; 
            generation_message?: string | null;
          };
          setState(prev => ({
            ...prev,
            generationDisabled: newData.generation_disabled ?? false,
            generationMessage: newData.generation_message || DEFAULT_STATE.generationMessage,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMaintenanceStatus]);

  return {
    generationDisabled: state.generationDisabled,
    generationMessage: state.generationMessage,
    loading: state.loading,
    error: state.error,
    refetch: fetchMaintenanceStatus,
  };
}
