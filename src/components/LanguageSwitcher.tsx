import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LanguageSwitcherProps {
  variant?: "icon" | "full" | "minimal";
  className?: string;
}

export function LanguageSwitcher({ variant = "icon", className = "" }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  if (variant === "minimal") {
    return (
      <button
        onClick={() => setLanguage(language === "uk" ? "ru" : "uk")}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors hover:bg-muted ${className}`}
      >
        {language === "uk" ? "UA" : "RU"}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size={variant === "icon" ? "icon" : "sm"} 
          className={className}
        >
          {variant === "icon" ? (
            <Languages className="h-4 w-4" />
          ) : (
            <span className="flex items-center gap-1.5">
              <Languages className="h-4 w-4" />
              {language === "uk" ? "UA" : "RU"}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => setLanguage("uk")}
          className={language === "uk" ? "bg-accent" : ""}
        >
          🇺🇦 Українська
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setLanguage("ru")}
          className={language === "ru" ? "bg-accent" : ""}
        >
          🇷🇺 Русский
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
