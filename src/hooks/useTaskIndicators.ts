import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

  const fetchIndicators = async () => {
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
        setHasNewTasks((newTasks?.length || 0) > 0);
      }

      // Check for problematic tasks (assigned to user or created by user)
      const { data: problematicTasks, error: probError } = await supabase
        .from("admin_tasks")
        .select("id")
        .eq("status", "problematic")
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
        .limit(1);

      if (!probError) {
        setHasProblematic((problematicTasks?.length || 0) > 0);
      }
    } catch (error) {
      console.error("Error fetching task indicators:", error);
    } finally {
      setLoading(false);
    }
  };

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
  }, [user?.id]);

  return { hasNewTasks, hasProblematic, loading };
};
