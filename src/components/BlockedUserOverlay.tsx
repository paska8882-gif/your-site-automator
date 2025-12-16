import { Ban, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlockedUserOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <Ban className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Ваш доступ заблоковано
          </h1>
          <p className="text-muted-foreground">
            Зверніться в підтримку для вирішення питання
          </p>
        </div>
        <Button asChild className="gap-2">
          <a href="https://t.me/assanatraf" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            Написати в підтримку
          </a>
        </Button>
      </div>
    </div>
  );
}