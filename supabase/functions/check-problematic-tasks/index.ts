import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ==========================================
    // RATE-LIMIT GUARD: prevent duplicate/parallel runs (min 10 min between runs)
    // ==========================================
    const { data: limitRow } = await supabase
      .from("system_limits")
      .select("last_tasks_check_at")
      .eq("id", "global")
      .single();

    if (limitRow?.last_tasks_check_at) {
      const lastCheck = new Date(limitRow.last_tasks_check_at);
      const minutesSinceLastCheck = (Date.now() - lastCheck.getTime()) / 60000;
      if (minutesSinceLastCheck < 10) {
        console.log(`✅ Rate-limit guard: last check was ${minutesSinceLastCheck.toFixed(1)} min ago — skipping`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "rate_limited", minutes_since_last: minutesSinceLastCheck.toFixed(1) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Mark this run immediately to prevent parallel executions
    await supabase
      .from("system_limits")
      .update({ last_tasks_check_at: new Date().toISOString() })
      .eq("id", "global");

    // ==========================================
    // SMART EXIT: Check if there are any active tasks
    // ==========================================
    const { count: activeTaskCount, error: countError } = await supabase
      .from("admin_tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["todo", "in_progress"]);

    if (countError) {
      console.error("Error counting active tasks:", countError);
      throw countError;
    }

    if ((activeTaskCount ?? 0) === 0) {
      console.log("✅ No active tasks (todo/in_progress) — skipping check");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_active_tasks" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    console.log(`Found ${activeTaskCount} active task(s) — running problematic check`);

    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const { data: tasksToUpdate, error: fetchError } = await supabase
      .from("admin_tasks")
      .select("id, status, created_at, deadline, title, created_by")
      .in("status", ["todo", "in_progress"]);

    if (fetchError) {
      console.error("Error fetching tasks:", fetchError);
      throw fetchError;
    }

    const problematicTaskIds: string[] = [];
    const notifications: { user_id: string; title: string; message: string; type: string }[] = [];

    for (const task of tasksToUpdate || []) {
      const createdAt = new Date(task.created_at);
      const deadline = new Date(task.deadline);

      let shouldBeProblematic = false;

      // Task in 'todo' for more than 12 hours
      if (task.status === "todo" && createdAt < twelveHoursAgo) {
        shouldBeProblematic = true;
        console.log(`Task ${task.id} is problematic: in todo for more than 12 hours`);
      }

      // Task past deadline
      if (task.status === "in_progress" && deadline < now) {
        shouldBeProblematic = true;
        console.log(`Task ${task.id} is problematic: past deadline`);
      }

      if (shouldBeProblematic) {
        problematicTaskIds.push(task.id);
        notifications.push({
          user_id: task.created_by,
          title: "Проблемне завдання",
          message: `Завдання "${task.title}" стало проблемним через прострочення`,
          type: "task_problematic",
        });
      }
    }

    if (problematicTaskIds.length > 0) {
      const { error: updateError } = await supabase
        .from("admin_tasks")
        .update({ status: "problematic" })
        .in("id", problematicTaskIds);

      if (updateError) {
        console.error("Error updating tasks:", updateError);
        throw updateError;
      }

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("Error creating notifications:", notifError);
      }

      console.log(`Updated ${problematicTaskIds.length} tasks to problematic status`);
    } else {
      console.log("No tasks became problematic this run");
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: problematicTaskIds.length,
        taskIds: problematicTaskIds
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-problematic-tasks:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
