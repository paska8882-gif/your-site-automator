import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTaskNotificationSound } from "@/hooks/useTaskNotificationSound";

interface TaskIndicators {
  hasNewTasks: boolean;
  hasProblematic: boolean;
  loading: boolean;
}

export const useTaskIndicators = (): TaskIndicators => {
  const { user } = useAuth();
  const [hasNewTasks, setHasNewTasks] = useState(false);
  const [hasProblematic, setHasProblematic] = useState(false);
  const [loading, setLoading] = useState(true);
  const { playNewTaskSound, playProblematicTaskSound } = useTaskNotificationSound();
  
  const prevHasNewTasks = useRef(false);
  const prevHasProblematic = useRef(false);
  const isInitialLoad = useRef(true);

  const fetchIndicators = useCallback(async () => {
    if (!user) return;

    try {
      // Check for tasks assigned to current user that are in 'todo' status (new/pending)
      const { data: newTasks, error: newError } = await supabase
        .from("admin_tasks")
        .select("id")
        .eq("assigned_to", user.id)
        .eq("status", "todo")
        .limit(1);

      if (!newError) {
        const newHasNewTasks = (newTasks?.length || 0) > 0;
        
        // Play sound if new tasks appeared (not on initial load)
        if (!isInitialLoad.current && newHasNewTasks && !prevHasNewTasks.current) {
          playNewTaskSound();
        }
        
        prevHasNewTasks.current = newHasNewTasks;
        setHasNewTasks(newHasNewTasks);
      }

      // Check for problematic tasks (assigned to user or created by user)
      const { data: problematicTasks, error: probError } = await supabase
        .from("admin_tasks")
        .select("id")
        .eq("status", "problematic")
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
        .limit(1);

      if (!probError) {
        const newHasProblematic = (problematicTasks?.length || 0) > 0;
        
        // Play sound if problematic tasks appeared (not on initial load)
        if (!isInitialLoad.current && newHasProblematic && !prevHasProblematic.current) {
          playProblematicTaskSound();
        }
        
        prevHasProblematic.current = newHasProblematic;
        setHasProblematic(newHasProblematic);
      }
      
      isInitialLoad.current = false;
    } catch (error) {
      console.error("Error fetching task indicators:", error);
    } finally {
      setLoading(false);
    }
  }, [user, playNewTaskSound, playProblematicTaskSound]);

  useEffect(() => {
    fetchIndicators();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("task-indicators")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_tasks" },
        () => {
          fetchIndicators();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchIndicators]);

  return { hasNewTasks, hasProblematic, loading };
};
