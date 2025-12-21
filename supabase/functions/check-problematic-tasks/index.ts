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

    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    // Get tasks that should become problematic:
    // 1. Still in 'todo' status and created more than 12 hours ago
    // 2. In 'in_progress' status but past deadline (24 hours from creation)
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

      // Task past deadline (not completed within 24 hours)
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

    // Update tasks to problematic status
    if (problematicTaskIds.length > 0) {
      const { error: updateError } = await supabase
        .from("admin_tasks")
        .update({ status: "problematic" })
        .in("id", problematicTaskIds);

      if (updateError) {
        console.error("Error updating tasks:", updateError);
        throw updateError;
      }

      // Send notifications
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("Error creating notifications:", notifError);
      }

      console.log(`Updated ${problematicTaskIds.length} tasks to problematic status`);
    } else {
      console.log("No tasks to update");
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
