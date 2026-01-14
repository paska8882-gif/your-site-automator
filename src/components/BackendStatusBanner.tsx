import { AlertTriangle, MessageCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { uk } from "date-fns/locale";

interface BackendStatusBannerProps {
  isDown: boolean;
  onRetry: () => void;
  isRetrying?: boolean;
  lastErrorAt?: number | null;
  consecutiveFailures?: number;
  className?: string;
}

export function BackendStatusBanner({
  isDown,
  onRetry,
  isRetrying = false,
  lastErrorAt,
  consecutiveFailures = 0,
  className,
}: BackendStatusBannerProps) {
  if (!isDown) return null;

  const downSince = lastErrorAt
    ? formatDistanceToNow(new Date(lastErrorAt), { addSuffix: true, locale: uk })
    : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "w-full border-b border-destructive/30 bg-destructive/10",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              Сервіс тимчасово недоступний
            </span>
            <span className="text-xs text-muted-foreground">
              {downSince && `Недоступний ${downSince}`}
              {consecutiveFailures > 0 && ` • ${consecutiveFailures} невдалих спроб`}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 pl-8 sm:pl-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="gap-2"
          >
            {isRetrying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Перевіряю...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Спробувати знову
              </>
            )}
          </Button>
          
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://t.me/dragonwhite7"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Підтримка
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
