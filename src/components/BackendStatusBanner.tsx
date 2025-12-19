import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackendStatusBannerProps {
  isDown: boolean;
  onRetry: () => void;
  className?: string;
}

export function BackendStatusBanner({ isDown, onRetry, className }: BackendStatusBannerProps) {
  if (!isDown) return null;

  return (
    <div
      role="status"
      className={cn(
        "w-full border-b border-border/60 bg-muted/50",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>
            Бекенд тимчасово недоступний — дані можуть не завантажуватись.
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Спробувати знову
        </Button>
      </div>
    </div>
  );
}
