import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Bell, Headphones, Quote } from "lucide-react";
import { AdminFeedbackTab } from "./AdminFeedbackTab";
import { AdminNotificationsManager } from "./AdminNotificationsManager";
import { AdminSupportTab } from "./AdminSupportTab";
import { AdminQuotesTab } from "./AdminQuotesTab";

const tabConfig = {
  feedback: { icon: MessageCircle, title: "Фідбек", description: "Відгуки від користувачів" },
  notifications: { icon: Bell, title: "Сповіщення", description: "Масові повідомлення" },
  support: { icon: Headphones, title: "Підтримка", description: "Чати з користувачами" },
  quotes: { icon: Quote, title: "Цитати", description: "Мотиваційні цитати" },
};

export function AdminCommunicationTab() {
  const [activeTab, setActiveTab] = useState<keyof typeof tabConfig>("feedback");
  const currentConfig = tabConfig[activeTab];
  const Icon = currentConfig.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{currentConfig.title}</h1>
          <p className="text-xs text-muted-foreground">{currentConfig.description}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as keyof typeof tabConfig)}>
        <TabsList className="grid w-full grid-cols-4 h-8">
          <TabsTrigger value="feedback" className="text-xs gap-1">
            <MessageCircle className="h-3 w-3" />
            Фідбек
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1">
            <Bell className="h-3 w-3" />
            Сповіщення
          </TabsTrigger>
          <TabsTrigger value="support" className="text-xs gap-1">
            <Headphones className="h-3 w-3" />
            Підтримка
          </TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs gap-1">
            <Quote className="h-3 w-3" />
            Цитати
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="feedback" className="mt-4">
          <AdminFeedbackTab />
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-4">
          <div className="max-w-md">
            <AdminNotificationsManager />
          </div>
        </TabsContent>
        
        <TabsContent value="support" className="mt-4">
          <AdminSupportTab />
        </TabsContent>
        
        <TabsContent value="quotes" className="mt-4">
          <AdminQuotesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}