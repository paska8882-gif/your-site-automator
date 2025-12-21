import { useNavigate, useLocation } from "react-router-dom";
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
  ClipboardList
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useTheme } from "@/hooks/useTheme";
import { NotificationBell } from "./NotificationBell";
import { SupportChat } from "./SupportChat";

const mainNavItems = [
  { title: "Генератор", url: "/", icon: Sparkles },
  { title: "Історія", url: "/history", icon: History },
  { title: "Баланс", url: "/balance", icon: Wallet },
  { title: "Команда", url: "/team", icon: Users },
];

const adminNavItems = [
  { title: "Завдання", tab: "tasks", icon: ClipboardList },
  { title: "Команди", tab: "teams", icon: Users },
  { title: "Сайти", tab: "sites", icon: FileCode },
  { title: "Користувачі", tab: "users", icon: UserCog },
  { title: "Апеляції", tab: "appeals", icon: MessageSquare },
  { title: "Комунікація", tab: "communication", icon: MessageCircle },
  { title: "Поповнення", tab: "balance-requests", icon: Wallet },
  { title: "Реферали", tab: "referral", icon: Gift },
  { title: "Фінанси", tab: "finance", icon: DollarSign },
  { title: "Адміни", tab: "admin", icon: Settings },
];

const superAdminNavItems = [
  { title: "Реквізити", tab: "payment-details", icon: CreditCard },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { isSuperAdmin } = useSuperAdmin();
  const { state } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const collapsed = state === "collapsed";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
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

      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-sidebar-muted px-2">
            Меню
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {/* Admin Section */}
        {isAdmin && (
          <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-sidebar-muted px-2">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Адмін панель
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.tab}>
                    <SidebarMenuButton
                      onClick={() => navigate(`/admin?tab=${item.tab}`)}
                      isActive={isAdminPage && getAdminTab() === item.tab}
                      tooltip={item.title}
                      className="transition-colors"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
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
        {/* Notifications & Support */}
        {!collapsed && (
          <div className="flex items-center justify-center gap-1 mb-2 px-2">
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
                      <span className="truncate font-medium text-xs">Акаунт</span>
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
                  Вийти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
