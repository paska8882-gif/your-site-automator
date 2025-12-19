import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Bell, Headphones, Quote } from "lucide-react";
import { AdminFeedbackTab } from "./AdminFeedbackTab";
import { AdminNotificationsManager } from "./AdminNotificationsManager";
import { AdminSupportTab } from "./AdminSupportTab";
import { AdminQuotesTab } from "./AdminQuotesTab";

export function AdminCommunicationTab() {
  const [activeTab, setActiveTab] = useState("feedback");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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