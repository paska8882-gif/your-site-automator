import { useState } from "react";
import { Wrench, Loader2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

export function AdminGenerationMaintenanceToggle() {
  const { isSuperAdmin } = useSuperAdmin();
  const { generationDisabled, generationMessage, loading } = useMaintenanceMode();
  const [updating, setUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");

  // Sync local message state when not editing
  const displayMessage = isEditing ? message : generationMessage;

  const handleToggle = async (newValue: boolean) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("maintenance_mode")
        .update({ 
          generation_disabled: newValue,
          updated_at: new Date().toISOString()
        })
        .eq("id", "global");

      if (error) throw error;

      toast.success(
        newValue 
          ? "⚠️ Генерацію ВИМКНЕНО для користувачів" 
          : "✅ Генерацію увімкнено"
      );
    } catch (error) {
      console.error("Error toggling generation maintenance:", error);
      toast.error("Помилка зміни режиму");
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveMessage = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("maintenance_mode")
        .update({ 
          generation_message: message,
          updated_at: new Date().toISOString()
        })
        .eq("id", "global");

      if (error) throw error;

      toast.success("Повідомлення збережено");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating generation message:", error);
      toast.error("Помилка збереження");
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

  const enabled = generationDisabled;

  return (
    <Card className={`p-3 mb-4 ${enabled ? "bg-amber-500/10 border-amber-500/50" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {enabled ? (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          ) : (
            <Wrench className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <Label className="text-sm font-medium">
              Режим обслуговування генерації
            </Label>
            <p className="text-xs text-muted-foreground">
              {enabled 
                ? "Генерація вимкнена. Користувачі бачать повідомлення." 
                : "Генерація працює в нормальному режимі"
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
      </div>
      
      {enabled && (
        <div className="mt-3 pt-3 border-t border-amber-500/20">
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Повідомлення для користувачів..."
                className="text-sm"
              />
              <Button 
                size="sm" 
                onClick={handleSaveMessage}
                disabled={updating}
              >
                Зберегти
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                Скасувати
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                📢 {displayMessage || "Повідомлення не задано"}
              </p>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  setMessage(generationMessage);
                  setIsEditing(true);
                }}
                className="text-xs"
              >
                Редагувати
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}