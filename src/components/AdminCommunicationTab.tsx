import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Bell, Headphones, Quote } from "lucide-react";
import { AdminFeedbackTab } from "./AdminFeedbackTab";
import { AdminNotificationsManager } from "./AdminNotificationsManager";
import { AdminSupportTab } from "./AdminSupportTab";
import { AdminQuotesTab } from "./AdminQuotesTab";
import { AdminPageHeader } from "./AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";

export function AdminCommunicationTab() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"feedback" | "notifications" | "support" | "quotes">("feedback");
  
  const tabConfig = {
    feedback: { icon: MessageCircle, title: t("admin.communicationTab.feedback"), description: t("admin.communicationTab.feedbackDesc") },
    notifications: { icon: Bell, title: t("admin.communicationTab.notifications"), description: t("admin.communicationTab.notificationsDesc") },
    support: { icon: Headphones, title: t("admin.communicationTab.support"), description: t("admin.communicationTab.supportDesc") },
    quotes: { icon: Quote, title: t("admin.communicationTab.quotes"), description: t("admin.communicationTab.quotesDesc") },
  };
  
  const currentConfig = tabConfig[activeTab];

  return (
    <div className="space-y-4">
      <AdminPageHeader 
        icon={currentConfig.icon} 
        title={currentConfig.title} 
        description={currentConfig.description} 
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "feedback" | "notifications" | "support" | "quotes")}>
        <TabsList className="grid w-full grid-cols-4 h-8">
          <TabsTrigger value="feedback" className="text-xs gap-1">
            <MessageCircle className="h-3 w-3" />
            {t("admin.communicationTab.feedback")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1">
            <Bell className="h-3 w-3" />
            {t("admin.communicationTab.notifications")}
          </TabsTrigger>
          <TabsTrigger value="support" className="text-xs gap-1">
            <Headphones className="h-3 w-3" />
            {t("admin.communicationTab.support")}
          </TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs gap-1">
            <Quote className="h-3 w-3" />
            {t("admin.communicationTab.quotes")}
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
