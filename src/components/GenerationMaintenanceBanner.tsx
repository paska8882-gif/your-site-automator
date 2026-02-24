import { Wrench, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";

interface GenerationMaintenanceBannerProps {
  message: string;
}

export function GenerationMaintenanceBanner({ message }: GenerationMaintenanceBannerProps) {
  const { t } = useLanguage();
  
  return (
    <Alert variant="destructive" className="mb-4 border-amber-500/50 bg-amber-500/10">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Wrench className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <AlertTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4" />
            {t("maintenanceBanner.title")}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {message}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
