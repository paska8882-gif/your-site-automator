import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/contexts/UserDataContext";
import { useTaskNotificationSound } from "@/hooks/useTaskNotificationSound";

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
  const lastFetchTime = useRef(0);
  const minFetchInterval = 5000; // 5 seconds between fetches

  const fetchIndicators = useCallback(async () => {
    // Only fetch if user is admin
    if (!user || !isAdmin) {
      setHasNewTasks(false);
      setHasProblematic(false);
      setLoading(false);
      return;
    }

    // Throttle requests
    const now = Date.now();
    if (now - lastFetchTime.current < minFetchInterval) {
      return;
    }
    lastFetchTime.current = now;

    try {
      // Single query to get both counts
      const [newTasksResult, problematicResult] = await Promise.all([
        supabase
          .from("admin_tasks")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", user.id)
          .eq("status", "todo"),
        supabase
          .from("admin_tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "problematic")
          .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`),
      ]);

      const newHasNewTasks = (newTasksResult.count || 0) > 0;
      const newHasProblematic = (problematicResult.count || 0) > 0;
      
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

  useEffect(() => {
    // Only set up subscription for admins
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

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
  }, [fetchIndicators, user, isAdmin]);

  return { hasNewTasks, hasProblematic, loading };
};
