import { useState, useEffect } from "react";
import { Wrench, Loader2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export function AdminMaintenanceToggle() {
  const { isSuperAdmin } = useSuperAdmin();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from("maintenance_mode")
        .select("enabled")
        .eq("id", "global")
        .maybeSingle();

      if (!error && data) {
        setEnabled(data.enabled);
      }
      setLoading(false);
    };

    fetchStatus();

    // Subscribe to changes
    const channel = supabase
      .channel("maintenance_admin")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "maintenance_mode",
          filter: "id=eq.global",
        },
        (payload) => {
          setEnabled((payload.new as { enabled: boolean }).enabled);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleToggle = async (newValue: boolean) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("maintenance_mode")
        .update({ 
          enabled: newValue,
          updated_at: new Date().toISOString()
        })
        .eq("id", "global");

      if (error) throw error;

      setEnabled(newValue);
      toast.success(
        newValue 
          ? "⚠️ Глобальний техрежим УВІМКНЕНО (для користувачів)" 
          : "✅ Глобальний техрежим вимкнено"
      );
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      toast.error("Помилка зміни режиму");
    } finally {
      setUpdating(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (loading) {
    return null;
  }

  return (
    <Card className={`p-3 mb-4 flex items-center justify-between ${enabled ? "bg-amber-500/10 border-amber-500/50" : ""}`}>
      <div className="flex items-center gap-3">
        {enabled ? (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        ) : (
          <Wrench className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <Label className="text-sm font-medium">
            Глобальний техрежим
          </Label>
          <p className="text-xs text-muted-foreground">
            {enabled 
              ? "Користувачі бачать сторінку з повідомленням (адміни мають доступ)" 
              : "Сайт працює в нормальному режимі"
            }
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {updating && <Loader2 className="h-4 w-4 animate-spin" />}
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={updating}
        />
      </div>
    </Card>
  );
}
