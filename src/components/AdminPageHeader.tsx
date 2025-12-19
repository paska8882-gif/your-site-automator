import { LucideIcon } from "lucide-react";

interface AdminPageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function AdminPageHeader({ icon: Icon, title, description }: AdminPageHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}