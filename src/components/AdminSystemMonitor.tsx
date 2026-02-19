import { useState, useEffect } from "react";
import { Activity, Cpu, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRealtimeTable } from "@/contexts/RealtimeContext";

interface SystemLimits {
  active_generations: number;
  max_concurrent_generations: number;
  max_generations_per_user: number;
}

export function AdminSystemMonitor() {
  const { t } = useLanguage();
  const [limits, setLimits] = useState<SystemLimits | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLimits = async () => {
    const { data } = await supabase
      .from("system_limits")
      .select("*")
      .eq("id", "global")
      .single();
    
    if (data) {
      setLimits(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLimits();
    
    // Refresh every 5 minutes - cron handles active gen counting, realtime is primary
    const interval = setInterval(fetchLimits, 300_000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !limits) {
    return (
      <div className="border border-border p-3 animate-pulse">
        <div className="h-16 bg-muted rounded" />
      </div>
    );
  }

  const loadPercentage = Math.round(
    (limits.active_generations / limits.max_concurrent_generations) * 100
  );
  
  const getLoadColor = () => {
    if (loadPercentage < 50) return "text-green-500";
    if (loadPercentage < 80) return "text-yellow-500";
    return "text-destructive";
  };

  const getProgressColor = () => {
    if (loadPercentage < 50) return "bg-green-500";
    if (loadPercentage < 80) return "bg-yellow-500";
    return "bg-destructive";
  };

  return (
    <div className="border border-border">
      <div className="p-2 border-b border-border flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium">{t("admin.systemMonitor")}</span>
        <div className={`ml-auto flex items-center gap-1 ${getLoadColor()}`}>
          <Zap className="h-3 w-3" />
          <span className="text-xs font-bold">{loadPercentage}%</span>
        </div>
      </div>
      
      <div className="p-3 space-y-3">
        {/* Main progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{t("admin.activeGenerations")}</span>
            <span className="font-medium">
              {limits.active_generations} / {limits.max_concurrent_generations}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${loadPercentage}%` }}
            />
          </div>
        </div>
        
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-muted/50 rounded">
            <div className={`text-lg font-bold ${getLoadColor()}`}>
              {limits.active_generations}
            </div>
            <div className="text-[8px] text-muted-foreground uppercase">
              {t("admin.activeCurrent")}
            </div>
          </div>
          
          <div className="text-center p-2 bg-muted/50 rounded">
            <div className="text-lg font-bold">
              {limits.max_concurrent_generations}
            </div>
            <div className="text-[8px] text-muted-foreground uppercase">
              {t("admin.maxSystem")}
            </div>
          </div>
          
          <div className="text-center p-2 bg-muted/50 rounded">
            <div className="text-lg font-bold">
              {limits.max_generations_per_user}
            </div>
            <div className="text-[8px] text-muted-foreground uppercase">
              {t("admin.perUser")}
            </div>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <div className={`h-2 w-2 rounded-full ${
            loadPercentage < 80 ? "bg-green-500 animate-pulse" : "bg-destructive"
          }`} />
          <span className="text-muted-foreground">
            {loadPercentage < 50 
              ? t("admin.systemNormal")
              : loadPercentage < 80 
                ? t("admin.systemModerate")
                : t("admin.systemHigh")
            }
          </span>
        </div>
      </div>
    </div>
  );
}
