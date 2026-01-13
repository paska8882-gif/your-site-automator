import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify requesting user is an admin
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requester is admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { notifications } = body as { notifications: NotificationPayload[] };

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid notifications payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each notification
    const validatedNotifications: NotificationPayload[] = [];
    for (const notif of notifications) {
      if (!notif.user_id || typeof notif.user_id !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid user_id in notification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!notif.title || typeof notif.title !== "string" || notif.title.length > 500) {
        return new Response(
          JSON.stringify({ error: "Invalid title in notification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!notif.message || typeof notif.message !== "string" || notif.message.length > 2000) {
        return new Response(
          JSON.stringify({ error: "Invalid message in notification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!notif.type || typeof notif.type !== "string" || notif.type.length > 100) {
        return new Response(
          JSON.stringify({ error: "Invalid type in notification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      validatedNotifications.push({
        user_id: notif.user_id,
        title: notif.title.trim().substring(0, 500),
        message: notif.message.trim().substring(0, 2000),
        type: notif.type.trim().substring(0, 100),
        data: notif.data,
      });
    }

    // Limit batch size
    if (validatedNotifications.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Too many notifications (max 1000)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to insert notifications
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await serviceSupabase
      .from("notifications")
      .insert(validatedNotifications);

    if (error) {
      console.error("Error inserting notifications:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${user.id} created ${validatedNotifications.length} notifications`);

    return new Response(
      JSON.stringify({ success: true, count: validatedNotifications.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in create-notification:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
