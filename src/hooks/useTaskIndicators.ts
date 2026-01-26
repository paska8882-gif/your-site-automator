import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/contexts/UserDataContext";
import { useTaskNotificationSound } from "@/hooks/useTaskNotificationSound";
import { useRealtimeTable } from "@/contexts/RealtimeContext";

interface TaskIndicators {
  hasNewTasks: boolean;
  hasProblematic: boolean;
  loading: boolean;
}

export const useTaskIndicators = (): TaskIndicators => {
  const { user } = useAuth();
  const { isAdmin } = useUserData();
  const [hasNewTasks, setHasNewTasks] = useState(false);
  const [hasProblematic, setHasProblematic] = useState(false);
  const [loading, setLoading] = useState(true);
  const { playNewTaskSound, playProblematicTaskSound } = useTaskNotificationSound();
  
  const prevHasNewTasks = useRef(false);
  const prevHasProblematic = useRef(false);
  const isInitialLoad = useRef(true);

  // Use optimized RPC function instead of two separate queries
  const fetchIndicators = useCallback(async () => {
    if (!user || !isAdmin) {
      setHasNewTasks(false);
      setHasProblematic(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_task_indicators', {
        p_user_id: user.id
      });

      if (error) {
        console.error("Error fetching task indicators:", error);
        return;
      }

      const newHasNewTasks = data?.[0]?.has_new_tasks ?? false;
      const newHasProblematic = data?.[0]?.has_problematic ?? false;
      
      // Play sound if new tasks appeared (not on initial load)
      if (!isInitialLoad.current) {
        if (newHasNewTasks && !prevHasNewTasks.current) {
          playNewTaskSound();
        }
        if (newHasProblematic && !prevHasProblematic.current) {
          playProblematicTaskSound();
        }
      }
      
      prevHasNewTasks.current = newHasNewTasks;
      prevHasProblematic.current = newHasProblematic;
      setHasNewTasks(newHasNewTasks);
      setHasProblematic(newHasProblematic);
      isInitialLoad.current = false;
    } catch (error) {
      console.error("Error fetching task indicators:", error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, playNewTaskSound, playProblematicTaskSound]);

  // Initial fetch
  useEffect(() => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }
    fetchIndicators();
  }, [fetchIndicators, user, isAdmin]);

  // Subscribe to admin_tasks changes via centralized RealtimeContext
  const handleRealtimeUpdate = useCallback(() => {
    fetchIndicators();
  }, [fetchIndicators]);

  useRealtimeTable("admin_tasks", handleRealtimeUpdate, [handleRealtimeUpdate]);

  return { hasNewTasks, hasProblematic, loading };
};
