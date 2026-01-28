import { Wrench, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MaintenanceOverlayProps {
  message: string;
  supportLink: string;
}

export function MaintenanceOverlay({ message, supportLink }: MaintenanceOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="mx-auto w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center animate-pulse">
          <Wrench className="h-12 w-12 text-amber-500" />
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">
            🔧 Технічні роботи
          </h1>
          <p className="text-muted-foreground text-lg">
            {message}
          </p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <a href={supportLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-5 w-5" />
            Написати в підтримку
          </a>
        </Button>
      </div>
    </div>
  );
}
