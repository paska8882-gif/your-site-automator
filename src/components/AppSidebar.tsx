import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  History, 
  Users, 
  Settings, 
  LogOut, 
  ChevronUp,
  Shield,
  Sparkles,
  Wallet,
  FileCode,
  UserCog,
  DollarSign,
  MessageSquare,
  MessageCircle,
  CreditCard,
  Gift,
  ClipboardList,
  Gauge,
  TrendingUp,
  User,
  Wrench,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { useTheme } from "@/hooks/useTheme";
import { useTaskIndicators } from "@/hooks/useTaskIndicators";
import { useLanguage } from "@/contexts/LanguageContext";
import { NotificationBell } from "./NotificationBell";
import { SupportChat } from "./SupportChat";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

const getMainNavItems = (t: (key: string) => string) => [
  { title: t("sidebar.generator"), url: "/", icon: Sparkles },
  { title: t("sidebar.history"), url: "/history", icon: History },
  { title: t("sidebar.spends"), url: "/spends", icon: TrendingUp },
  { title: t("sidebar.balance"), url: "/balance", icon: Wallet },
  { title: t("sidebar.team"), url: "/team", icon: Users },
];

const getAdminNavItems = (t: (key: string) => string) => [
  { title: t("sidebar.tasks"), tab: "tasks", icon: ClipboardList },
  { title: t("sidebar.teams"), tab: "teams", icon: Users },
  { title: t("sidebar.sites"), tab: "sites", icon: FileCode },
  { title: t("sidebar.manualRequests"), tab: "manual-requests", icon: FileCode, highlight: "purple" },
  { title: t("sidebar.users"), tab: "users", icon: UserCog },
  { title: t("sidebar.appeals"), tab: "appeals", icon: MessageSquare },
  { title: t("sidebar.communication"), tab: "communication", icon: MessageCircle },
  { title: t("sidebar.topUp"), tab: "balance-requests", icon: Wallet },
  { title: t("sidebar.referrals"), tab: "referral", icon: Gift },
  { title: t("sidebar.finance"), tab: "finance", icon: DollarSign },
  { title: t("sidebar.admins"), tab: "admin", icon: Settings },
];

const getSuperAdminNavItems = (t: (key: string) => string) => [
  { title: t("sidebar.paymentDetails"), tab: "payment-details", icon: CreditCard },
];

// Compact maintenance toggle for sidebar
function MaintenanceToggleSidebar() {
  const { isSuperAdmin } = useSuperAdmin();
  const { maintenance, setEnabled, loading, refetch } = useMaintenanceMode();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [updating, setUpdating] = useState(false);
  const { t } = useLanguage();

  const handleToggle = async (newValue: boolean) => {
    const previousValue = maintenance.enabled;
    
    // Optimistic update - immediately change UI
    setEnabled(newValue);
    setUpdating(true);
    
    try {
      const { error } = await supabase
        .from("maintenance_mode")
        .update({ 
          enabled: newValue,
          updated_at: new Date().toISOString()
        })
        .eq("id", "global");

      if (error) {
        // Rollback on error
        setEnabled(previousValue);
        console.error("Error toggling maintenance mode:", error);
        toast.error("Помилка зміни режиму");
        return;
      }

      // Refetch to ensure sync
      await refetch();
      
      toast.success(
        newValue 
          ? "⚠️ Режим технічних робіт УВІМКНЕНО" 
          : "✅ Режим технічних робіт вимкнено"
      );
    } catch (error) {
      // Rollback on exception
      setEnabled(previousValue);
      console.error("Error toggling maintenance mode:", error);
      toast.error("Помилка зміни режиму");
    } finally {
      setUpdating(false);
    }
  };

  if (!isSuperAdmin || loading || collapsed) {
    return null;
  }

  const enabled = maintenance.enabled;

  return (
    <div className={`flex items-center justify-between gap-2 px-2 py-2 mb-2 rounded-md ${enabled ? "bg-amber-500/20" : "bg-sidebar-accent/50"}`}>
      <div className="flex items-center gap-2">
        {enabled ? (
          <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
        ) : (
          <Wrench className="h-4 w-4 text-muted-foreground" />
        )}
        <Label htmlFor="maintenance-mode" className={`text-xs font-medium cursor-pointer ${enabled ? "text-amber-500" : ""}`}>
          {t("sidebar.maintenance") || "Тех. роботи"}
        </Label>
      </div>
      <div className="flex items-center gap-1">
        {updating && <Loader2 className="h-3 w-3 animate-spin" />}
        <Switch
          id="maintenance-mode"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={updating}
          className="scale-75"
        />
      </div>
    </div>
  );
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { isSuperAdmin } = useSuperAdmin();
  const { isTeamOwner } = useTeamOwner();
  const { state } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { hasNewTasks, hasProblematic } = useTaskIndicators();
  const { t } = useLanguage();
  const { isAdminModeEnabled, setIsAdminModeEnabled } = useAdminMode();
  const collapsed = state === "collapsed";
  
  const mainNavItems = getMainNavItems(t);
  const adminNavItems = getAdminNavItems(t);
  const superAdminNavItems = getSuperAdminNavItems(t);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      // Ensure we always leave the protected area even if network is flaky
      navigate("/auth", { replace: true });
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isAdminPage = location.pathname === "/admin";
  
  const getAdminTab = () => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") || "teams";
  };

  const userEmail = user?.email || "";
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r-0 sidebar-gradient">
      {/* Header with Logo - Auth page style */}
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="relative group cursor-pointer"
            title={`${t("common.theme")}: ${theme === 'light' ? t("common.themeLight") : theme === 'dark' ? t("common.themeDark") : t("common.themeBlue")}`}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-lg blur-md animate-pulse opacity-30 pointer-events-none bg-sidebar-primary" />
            {/* Button */}
            <div className="relative w-9 h-9 rounded-lg flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110 group-active:scale-95 bg-sidebar-primary shadow-sidebar-primary/30">
              <span className="font-bold text-base text-sidebar-primary-foreground pointer-events-none">D</span>
            </div>
          </button>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-semibold text-sm tracking-tight truncate text-sidebar-foreground">
                DRAGON<span className="text-sidebar-muted">WHITE</span>
              </span>
              <span className="text-[10px] text-sidebar-muted">AI Generator</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-sidebar-muted px-2">
            {t("sidebar.menu")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="transition-colors"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Owner Dashboard - only visible for team owners */}
              {isTeamOwner && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/dashboard")}
                    isActive={isActive("/dashboard")}
                    tooltip={t("sidebar.dashboard")}
                    className="transition-colors text-amber-500"
                  >
                    <Gauge className="h-4 w-4" />
                    <span>{t("sidebar.dashboard")}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section - only visible when admin mode is enabled */}
        {isAdmin && isAdminModeEnabled && (
          <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-sidebar-muted px-2">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {t("sidebar.adminPanel")}
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => {
                  const isTasksItem = item.tab === "tasks";
                  const isPurpleItem = (item as any).highlight === "purple";
                  const hasIndicator = isTasksItem && (hasProblematic || hasNewTasks);
                  const indicatorBgClass = isTasksItem 
                    ? hasProblematic 
                      ? "bg-red-500/20 hover:bg-red-500/30" 
                      : hasNewTasks 
                        ? "bg-amber-500/20 hover:bg-amber-500/30" 
                        : ""
                    : isPurpleItem
                      ? "bg-purple-500/20 hover:bg-purple-500/30"
                      : "";
                  const indicatorTextClass = isTasksItem
                    ? hasProblematic
                      ? "text-red-500 animate-pulse font-semibold"
                      : hasNewTasks
                        ? "text-amber-500 animate-pulse font-semibold"
                        : ""
                    : isPurpleItem
                      ? "text-purple-500 font-semibold"
                      : "";
                  
                  return (
                    <SidebarMenuItem key={item.tab}>
                      <SidebarMenuButton
                        onClick={() => navigate(`/admin?tab=${item.tab}`)}
                        isActive={isAdminPage && getAdminTab() === item.tab}
                        tooltip={item.title}
                        className={`transition-colors ${indicatorBgClass}`}
                      >
                        <item.icon className={`h-4 w-4 ${isPurpleItem || hasIndicator ? indicatorTextClass : ""}`} />
                        <span className={indicatorTextClass}>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {isSuperAdmin && superAdminNavItems.map((item) => (
                  <SidebarMenuItem key={item.tab}>
                    <SidebarMenuButton
                      onClick={() => navigate(`/admin?tab=${item.tab}`)}
                      isActive={isAdminPage && getAdminTab() === item.tab}
                      tooltip={item.title}
                      className="transition-colors text-amber-500"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {/* Maintenance Mode Toggle - only for super admins */}
        <MaintenanceToggleSidebar />
        
        {/* Admin Mode Toggle - only for admins */}
        {isAdmin && !collapsed && (
          <div className="flex items-center justify-between gap-2 px-2 py-2 mb-2 rounded-md bg-sidebar-accent/50">
            <div className="flex items-center gap-2">
              {isAdminModeEnabled ? (
                <Shield className="h-4 w-4 text-primary" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
              <Label htmlFor="admin-mode" className="text-xs font-medium cursor-pointer">
                {isAdminModeEnabled ? t("sidebar.adminMode") : t("sidebar.buyerMode")}
              </Label>
            </div>
            <Switch
              id="admin-mode"
              checked={isAdminModeEnabled}
              onCheckedChange={setIsAdminModeEnabled}
              className="scale-75"
            />
          </div>
        )}
        
        {/* Notifications & Support */}
        {!collapsed && (
          <div className="flex items-center justify-center gap-1 mb-2 px-2">
            <LanguageSwitcher variant="icon" />
            <NotificationBell />
            <SupportChat />
          </div>
        )}
        
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-medium">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium text-xs">{t("common.account")}</span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {userEmail}
                      </span>
                    </div>
                  )}
                  {!collapsed && <ChevronUp className="ml-auto h-4 w-4" />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userEmail}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
