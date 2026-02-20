import { useState } from "react";
import { Wrench, Loader2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

export function AdminMaintenanceToggle() {
  const { isSuperAdmin } = useSuperAdmin();
  const { maintenance, loading } = useMaintenanceMode();
  const [updating, setUpdating] = useState(false);

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

  const enabled = maintenance.enabled;

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
