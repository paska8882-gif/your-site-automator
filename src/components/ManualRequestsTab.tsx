import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";
import { uk } from "date-fns/locale";
import JSZip from "jszip";
import { 
  Search, 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronDown,
  ChevronRight,
  Hand,
  Play,
  User,
  BarChart3,
  Timer,
  TrendingUp,
  CalendarIcon,
  Filter,
  X,
  DollarSign,
  ImageIcon,
  Crown
} from "lucide-react";

interface GeneratedFile {
  path: string;
  content: string;
}

interface ManualRequest {
  id: string;
  number: number;
  prompt: string;
  language: string;
  created_at: string;
  completed_at: string | null;
  taken_at: string | null;
  website_type: string | null;
  site_name: string | null;
  status: string;
  ai_model: string | null;
  user_id: string | null;
  team_id: string | null;
  sale_price: number | null;
  admin_note: string | null;
  assigned_admin_id: string | null;
  vip_prompt: string | null;
  vip_images: unknown; // JSON field from DB
}

interface UserProfile {
  user_id: string;
  display_name: string | null;
}

interface TeamInfo {
  id: string;
  name: string;
  balance: number;
}

interface TeamPricing {
  team_id: string;
  html_price: number;
  react_price: number;
  manual_price: number;
}

interface AdminStats {
  adminId: string;
  adminName: string;
  completedToday: number;
  avgWaitTime: number; // ms
  avgCompletionTime: number; // ms
}

// Helper function to format duration
function formatDuration(ms: number): string {
  if (ms < 0) return "—";
  
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}г ${mins}хв`;
  } else if (minutes > 0) {
    return `${minutes}хв ${seconds}с`;
  }
  return `${seconds}с`;
}

// Fetch manual requests
const fetchManualRequests = async () => {
  const { data, error } = await supabase
    .from("generation_history")
    .select("id, number, prompt, language, created_at, completed_at, taken_at, website_type, site_name, status, ai_model, user_id, team_id, sale_price, admin_note, assigned_admin_id, vip_prompt, vip_images")
    .in("status", ["manual_request", "manual_in_progress", "manual_completed", "manual_cancelled"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  
  const manualData = data || [];
  
  const userIds = [...new Set(manualData.flatMap(item => [item.user_id, item.assigned_admin_id]).filter(Boolean))] as string[];
  const teamIds = [...new Set(manualData.map(item => item.team_id).filter(Boolean))] as string[];
  
  let profilesMap: Record<string, UserProfile> = {};
  let teamsNameMap: Record<string, string> = {};
  
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    
    (profilesData || []).forEach(profile => {
      profilesMap[profile.user_id] = profile;
    });
  }
  
  if (teamIds.length > 0) {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", teamIds);
    
    (teamsData || []).forEach(t => {
      teamsNameMap[t.id] = t.name;
    });
  }
  
  return { requests: manualData, profilesMap, teamsNameMap };
};

// Fetch teams and pricing
const fetchTeamsData = async () => {
  const [teamsRes, pricingsRes] = await Promise.all([
    supabase.from("teams").select("id, name, balance").order("name"),
    supabase.from("team_pricing").select("team_id, html_price, react_price, manual_price")
  ]);
  return { teams: teamsRes.data || [], pricings: pricingsRes.data || [] };
};

type DatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";

export function ManualRequestsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  
  // Collapsible state
  const [newOpen, setNewOpen] = useState(true);
  const [inProgressOpen, setInProgressOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filters
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterBuyer, setFilterBuyer] = useState<string>("all");
  const [filterAdmin, setFilterAdmin] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  
  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelItem, setCancelItem] = useState<ManualRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  
  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadItem, setUploadItem] = useState<ManualRequest | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPrice, setUploadPrice] = useState(0);
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);
  
  // Details dialog
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<ManualRequest | null>(null);

  // Query data
  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ["manual-requests"],
    queryFn: fetchManualRequests,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  const { data: teamsData } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: fetchTeamsData,
    staleTime: 10 * 60 * 1000,
  });

  const requests = requestsData?.requests || [];
  const profiles = requestsData?.profilesMap || {};
  const teamsMap = requestsData?.teamsNameMap || {};
  const teams = teamsData?.teams || [];
  const teamPricings = teamsData?.pricings || [];

  // Get unique buyers and admins for filters
  const uniqueBuyers = useMemo(() => {
    const buyerIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))] as string[];
    return buyerIds.map(id => ({
      id,
      name: profiles[id]?.display_name || id.slice(0, 8) + "..."
    }));
  }, [requests, profiles]);

  const uniqueAdmins = useMemo(() => {
    const adminIds = [...new Set(requests.map(r => r.assigned_admin_id).filter(Boolean))] as string[];
    return adminIds.map(id => ({
      id,
      name: profiles[id]?.display_name || id.slice(0, 8) + "..."
    }));
  }, [requests, profiles]);

  // Date range based on preset
  const getDateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
      case "week":
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "custom":
        return { from: dateFrom, to: dateTo };
      default:
        return { from: undefined, to: undefined };
    }
  }, [datePreset, dateFrom, dateTo]);

  // Filter function
  const applyFilters = (items: ManualRequest[]) => {
    return items.filter(r => {
      // Search filter
      if (searchQuery && 
          !r.site_name?.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !r.prompt.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Team filter
      if (filterTeam !== "all" && r.team_id !== filterTeam) {
        return false;
      }
      
      // Buyer filter
      if (filterBuyer !== "all" && r.user_id !== filterBuyer) {
        return false;
      }
      
      // Admin filter
      if (filterAdmin !== "all" && r.assigned_admin_id !== filterAdmin) {
        return false;
      }
      
      // Date filter
      const { from, to } = getDateRange;
      if (from || to) {
        const createdDate = new Date(r.created_at);
        if (from && createdDate < from) return false;
        if (to && createdDate > to) return false;
      }
      
      return true;
    });
  };

  // Group requests
  const newRequests = useMemo(() => 
    applyFilters(requests.filter(r => r.status === "manual_request")),
    [requests, searchQuery, filterTeam, filterBuyer, filterAdmin, getDateRange]
  );

  const inProgressRequests = useMemo(() => 
    applyFilters(requests.filter(r => r.status === "manual_in_progress")),
    [requests, searchQuery, filterTeam, filterBuyer, filterAdmin, getDateRange]
  );

  const completedRequests = useMemo(() => 
    applyFilters(requests.filter(r => r.status === "manual_completed" || r.status === "manual_cancelled"))
      .slice(0, 100), // Limit to last 100
    [requests, searchQuery, filterTeam, filterBuyer, filterAdmin, getDateRange]
  );

  // Calculate totals for each section
  const newRequestsTotal = useMemo(() => 
    newRequests.reduce((sum, r) => sum + (r.sale_price || 0), 0),
    [newRequests]
  );

  const inProgressTotal = useMemo(() => 
    inProgressRequests.reduce((sum, r) => sum + (r.sale_price || 0), 0),
    [inProgressRequests]
  );

  const completedTotal = useMemo(() => 
    completedRequests
      .filter(r => r.status === "manual_completed")
      .reduce((sum, r) => sum + (r.sale_price || 0), 0),
    [completedRequests]
  );

  // Check if any filter is active
  const hasActiveFilters = filterTeam !== "all" || filterBuyer !== "all" || filterAdmin !== "all" || datePreset !== "all";

  // Clear all filters
  const clearFilters = () => {
    setFilterTeam("all");
    setFilterBuyer("all");
    setFilterAdmin("all");
    setDatePreset("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // Calculate admin stats
  const adminStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const statsMap = new Map<string, { 
      completedToday: number; 
      waitTimes: number[]; 
      completionTimes: number[]; 
    }>();

    requests.forEach(r => {
      if (!r.assigned_admin_id) return;
      
      if (!statsMap.has(r.assigned_admin_id)) {
        statsMap.set(r.assigned_admin_id, { completedToday: 0, waitTimes: [], completionTimes: [] });
      }
      
      const stats = statsMap.get(r.assigned_admin_id)!;
      
      // Count completed today
      if (r.status === "manual_completed" && r.completed_at) {
        const completedDate = new Date(r.completed_at);
        if (completedDate >= today) {
          stats.completedToday++;
        }
      }
      
      // Wait time (created_at to taken_at)
      if (r.taken_at) {
        const waitTime = new Date(r.taken_at).getTime() - new Date(r.created_at).getTime();
        if (waitTime > 0) stats.waitTimes.push(waitTime);
      }
      
      // Completion time (taken_at to completed_at)
      if (r.taken_at && r.completed_at) {
        const completionTime = new Date(r.completed_at).getTime() - new Date(r.taken_at).getTime();
        if (completionTime > 0) stats.completionTimes.push(completionTime);
      }
    });

    const result: AdminStats[] = [];
    statsMap.forEach((stats, adminId) => {
      const adminProfile = profiles[adminId];
      result.push({
        adminId,
        adminName: adminProfile?.display_name || adminId.slice(0, 8) + "...",
        completedToday: stats.completedToday,
        avgWaitTime: stats.waitTimes.length > 0 
          ? stats.waitTimes.reduce((a, b) => a + b, 0) / stats.waitTimes.length 
          : 0,
        avgCompletionTime: stats.completionTimes.length > 0 
          ? stats.completionTimes.reduce((a, b) => a + b, 0) / stats.completionTimes.length 
          : 0,
      });
    });

    return result.sort((a, b) => b.completedToday - a.completedToday);
  }, [requests, profiles]);

  // Global stats
  const globalStats = useMemo(() => {
    const completedWithTimes = requests.filter(r => r.status === "manual_completed" && r.taken_at && r.completed_at);
    
    let avgWaitTime = 0;
    let avgCompletionTime = 0;
    let avgTotalTime = 0;

    if (completedWithTimes.length > 0) {
      const waitTimes = completedWithTimes
        .filter(r => r.taken_at)
        .map(r => new Date(r.taken_at!).getTime() - new Date(r.created_at).getTime())
        .filter(t => t > 0);
      
      const completionTimes = completedWithTimes
        .filter(r => r.taken_at && r.completed_at)
        .map(r => new Date(r.completed_at!).getTime() - new Date(r.taken_at!).getTime())
        .filter(t => t > 0);
      
      const totalTimes = completedWithTimes
        .filter(r => r.completed_at)
        .map(r => new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime())
        .filter(t => t > 0);

      if (waitTimes.length > 0) avgWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
      if (completionTimes.length > 0) avgCompletionTime = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
      if (totalTimes.length > 0) avgTotalTime = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;
    }

    return { avgWaitTime, avgCompletionTime, avgTotalTime };
  }, [requests]);

  const getUserName = (userId: string | null) => {
    if (!userId) return "—";
    const profile = profiles[userId];
    return profile?.display_name || userId.slice(0, 8) + "...";
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return "—";
    return teamsMap[teamId] || "—";
  };

  // Take in work
  const handleTakeInWork = async (item: ManualRequest) => {
    try {
      const { error } = await supabase
        .from("generation_history")
        .update({ 
          status: "manual_in_progress",
          assigned_admin_id: user?.id,
          taken_at: new Date().toISOString()
        })
        .eq("id", item.id);

      if (error) throw error;
      
      toast.success(t("admin.manualRequestTaken"));
      refetch();
    } catch (error) {
      console.error("Error taking manual request:", error);
      toast.error(t("common.error"));
    }
  };

  // Cancel request
  const handleCancelRequest = async () => {
    if (!cancelItem) return;

    setCancelling(true);
    try {
      const { error } = await supabase
        .from("generation_history")
        .update({ 
          status: "manual_cancelled",
          error_message: cancelReason || null,
          completed_at: new Date().toISOString()
        })
        .eq("id", cancelItem.id);

      if (error) throw error;
      
      toast.success(t("admin.requestCancelled"));
      setCancelDialogOpen(false);
      setCancelItem(null);
      setCancelReason("");
      refetch();
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast.error(t("common.error"));
    } finally {
      setCancelling(false);
    }
  };

  // Open upload dialog
  const handleOpenUpload = (item: ManualRequest) => {
    const pricing = item.team_id ? teamPricings.find(p => p.team_id === item.team_id) : null;
    const defaultPrice = pricing 
      ? (pricing.manual_price || (item.website_type === "react" ? pricing.react_price : pricing.html_price))
      : (item.sale_price || 0);

    setUploadItem(item);
    setUploadPrice(defaultPrice);
    setUploadNote("");
    setUploadFile(null);
    setUploadDialogOpen(true);
  };

  // Complete request
  const handleCompleteRequest = async () => {
    if (!uploadFile || !uploadItem) {
      toast.error(t("admin.fillAllFields"));
      return;
    }

    // Validate file is actually a ZIP
    if (!uploadFile.name.toLowerCase().endsWith('.zip')) {
      toast.error("Підтримується лише формат .zip. Файли .rar та інші формати не підтримуються.");
      return;
    }

    setUploading(true);

    try {
      const zip = new JSZip();
      let zipContent;
      try {
        zipContent = await zip.loadAsync(uploadFile);
      } catch (zipError) {
        toast.error("Не вдалося прочитати ZIP-файл. Переконайтесь що файл не пошкоджений та має формат .zip (не .rar).");
        setUploading(false);
        return;
      }
      
      const textExtensions = ['.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.xml', '.svg', '.txt', '.md', '.php'];
      const filesData: GeneratedFile[] = [];
      const filePromises: Promise<void>[] = [];
      
      zipContent.forEach((relativePath, file) => {
        if (!file.dir) {
          const ext = relativePath.toLowerCase().substring(relativePath.lastIndexOf('.'));
          if (textExtensions.includes(ext)) {
            filePromises.push(
              file.async("text").then(content => {
                filesData.push({ path: relativePath, content });
              }).catch(() => {})
            );
          }
        }
      });
      
      await Promise.all(filePromises);

      const arrayBuffer = await uploadFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const zipBase64 = btoa(binary);

      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("generation_history")
        .update({
          status: "manual_completed",
          files_data: filesData.length > 0 ? (filesData as unknown as null) : null,
          zip_data: zipBase64,
          completed_at: now,
          sale_price: uploadPrice,
          admin_note: uploadNote || null,
          image_source: "manual"
        })
        .eq("id", uploadItem.id);

      if (updateError) throw updateError;

      // Update team balance
      if (uploadPrice > 0 && uploadItem.team_id) {
        const team = teams.find(t => t.id === uploadItem.team_id);
        if (team) {
          const { error: balanceError } = await supabase
            .from("teams")
            .update({ balance: team.balance - uploadPrice })
            .eq("id", uploadItem.team_id);

          if (balanceError) throw balanceError;

          await supabase
            .from("balance_transactions")
            .insert({
              team_id: uploadItem.team_id,
              amount: -uploadPrice,
              balance_before: team.balance,
              balance_after: team.balance - uploadPrice,
              note: `Ручна генерація: ${uploadItem.site_name || `Site ${uploadItem.number}`}`,
              admin_id: user?.id || ""
            });
        }
      }

      toast.success(t("admin.manualRequestCompleted"));
      setUploadDialogOpen(false);
      setUploadItem(null);
      setUploadFile(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    } catch (error) {
      console.error("Error completing manual request:", error);
      toast.error(t("admin.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  // Download ZIP
  const handleDownload = async (item: ManualRequest) => {
    const { data, error } = await supabase
      .from("generation_history")
      .select("zip_data")
      .eq("id", item.id)
      .single();
    
    if (error || !data?.zip_data) {
      toast.error("Не вдалося завантажити файл");
      return;
    }

    const byteCharacters = atob(data.zip_data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/zip" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.site_name || `site-${item.number}`}-${item.language}-manual.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render table row
  const renderRow = (item: ManualRequest, showAdmin = false) => {
    const waitTime = item.taken_at 
      ? new Date(item.taken_at).getTime() - new Date(item.created_at).getTime()
      : null;
    const completionTime = item.taken_at && item.completed_at
      ? new Date(item.completed_at).getTime() - new Date(item.taken_at).getTime()
      : null;
    const totalTime = item.completed_at
      ? new Date(item.completed_at).getTime() - new Date(item.created_at).getTime()
      : null;

    return (
      <TableRow 
        key={item.id} 
        className="cursor-pointer hover:bg-accent/50"
        onClick={() => {
          setDetailsItem(item);
          setDetailsOpen(true);
        }}
      >
        <TableCell className="font-mono text-xs">{item.number}</TableCell>
        <TableCell className="max-w-[200px] truncate">
          <span className="flex items-center gap-1">
            {item.site_name || `Site ${item.number}`}
            {item.vip_images && Array.isArray(item.vip_images) && (item.vip_images as string[]).length > 0 && (
              <span title={`${(item.vip_images as string[]).length} зображень`}>
                <Crown className="h-3 w-3 text-purple-500 shrink-0" />
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className="text-xs">{getTeamName(item.team_id)}</TableCell>
        <TableCell className="text-xs">{getUserName(item.user_id)}</TableCell>
        <TableCell className="text-xs font-medium text-green-600">
          {item.sale_price ? `$${item.sale_price.toFixed(2)}` : "—"}
        </TableCell>
        {showAdmin && (
          <TableCell className="text-xs font-medium text-blue-600">
            {getUserName(item.assigned_admin_id)}
          </TableCell>
        )}
        <TableCell className="text-xs">
          {new Date(item.created_at).toLocaleString("uk-UA", { 
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" 
          })}
        </TableCell>
        {item.status === "manual_request" && (
          <TableCell className="text-xs text-muted-foreground">
            <span className="text-yellow-600">
              ⏳ {formatDuration(Date.now() - new Date(item.created_at).getTime())}
            </span>
          </TableCell>
        )}
        {item.status === "manual_in_progress" && (
          <>
            <TableCell className="text-xs">
              <span className="text-yellow-600">{waitTime ? formatDuration(waitTime) : "—"}</span>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              ⏳ {formatDuration(Date.now() - new Date(item.taken_at!).getTime())}
            </TableCell>
          </>
        )}
        {(item.status === "manual_completed" || item.status === "manual_cancelled") && (
          <>
            <TableCell className="text-xs">{waitTime ? formatDuration(waitTime) : "—"}</TableCell>
            <TableCell className="text-xs">{completionTime ? formatDuration(completionTime) : "—"}</TableCell>
            <TableCell className="text-xs font-medium">{totalTime ? formatDuration(totalTime) : "—"}</TableCell>
          </>
        )}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {item.status === "manual_request" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-purple-500 hover:bg-purple-600"
                  onClick={() => handleTakeInWork(item)}
                >
                  <Play className="h-3 w-3 mr-1" />
                  {t("admin.takeInWork")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setCancelItem(item);
                    setCancelDialogOpen(true);
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {item.status === "manual_in_progress" && (
              <Button
                size="sm"
                className="h-7 text-xs bg-green-500 hover:bg-green-600"
                onClick={() => handleOpenUpload(item)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t("admin.complete")}
              </Button>
            )}
            {["completed", "manual_completed"].includes(item.status) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleDownload(item)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      <AdminPageHeader 
        icon={Hand} 
        title={t("admin.manualRequestsTitle")} 
        description={t("admin.manualRequestsDescription")} 
      />

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Global Time Analytics */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4" />
              {t("admin.timeAnalytics")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">{t("admin.avgWaitTime")}</div>
                <div className="text-lg font-bold text-yellow-600">
                  {globalStats.avgWaitTime ? formatDuration(globalStats.avgWaitTime) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("admin.avgCompletionTime")}</div>
                <div className="text-lg font-bold text-blue-600">
                  {globalStats.avgCompletionTime ? formatDuration(globalStats.avgCompletionTime) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("admin.avgTotalTime")}</div>
                <div className="text-lg font-bold text-green-600">
                  {globalStats.avgTotalTime ? formatDuration(globalStats.avgTotalTime) : "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Workload */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t("admin.adminWorkload")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {adminStats.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">{t("admin.noData")}</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {adminStats.map(stat => (
                  <div key={stat.adminId} className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[120px]">{stat.adminName}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600" title={t("admin.completedToday")}>
                        ✓ {stat.completedToday}
                      </span>
                      <span className="text-yellow-600" title={t("admin.avgWaitTime")}>
                        ⏳ {stat.avgWaitTime ? formatDuration(stat.avgWaitTime) : "—"}
                      </span>
                      <span className="text-blue-600" title={t("admin.avgCompletionTime")}>
                        ⚡ {stat.avgCompletionTime ? formatDuration(stat.avgCompletionTime) : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("admin.sitesFilters.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8"
            />
          </div>

          {/* Toggle Filters */}
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            {t("admin.filters")}
            {hasActiveFilters && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                !
              </Badge>
            )}
          </Button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={clearFilters}
            >
              <X className="h-4 w-4 mr-1" />
              {t("admin.clearFilters")}
            </Button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Team Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.sitesTable.team")}</Label>
                <Select value={filterTeam} onValueChange={setFilterTeam}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.allTeams")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.allTeams")}</SelectItem>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Buyer Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.sitesTable.user")}</Label>
                <Select value={filterBuyer} onValueChange={setFilterBuyer}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.allBuyers")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.allBuyers")}</SelectItem>
                    {uniqueBuyers.map(buyer => (
                      <SelectItem key={buyer.id} value={buyer.id}>{buyer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Admin Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.assignedAdmin")}</Label>
                <Select value={filterAdmin} onValueChange={setFilterAdmin}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.allAdmins")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.allAdmins")}</SelectItem>
                    {uniqueAdmins.map(admin => (
                      <SelectItem key={admin.id} value={admin.id}>{admin.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.dateFilter")}</Label>
                <Select 
                  value={datePreset} 
                  onValueChange={(v) => {
                    setDatePreset(v as DatePreset);
                    if (v !== "custom") {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.allDates")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.allDates")}</SelectItem>
                    <SelectItem value="today">{t("admin.dateToday")}</SelectItem>
                    <SelectItem value="yesterday">{t("admin.dateYesterday")}</SelectItem>
                    <SelectItem value="week">{t("admin.dateWeek")}</SelectItem>
                    <SelectItem value="month">{t("admin.dateMonth")}</SelectItem>
                    <SelectItem value="custom">{t("admin.dateCustom")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range */}
            {datePreset === "custom" && (
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("admin.dateFrom")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-8 w-[180px] justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd.MM.yyyy") : t("admin.selectDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        locale={uk}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t("admin.dateTo")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-8 w-[180px] justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd.MM.yyyy") : t("admin.selectDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        locale={uk}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* New Requests */}
          <Collapsible open={newOpen} onOpenChange={setNewOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-2 px-4 cursor-pointer hover:bg-accent/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {newOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Hand className="h-4 w-4 text-purple-500" />
                    {t("admin.newRequests")} 
                    <Badge variant="secondary" className="bg-purple-500 text-white">
                      {newRequests.length}
                    </Badge>
                    {newRequestsTotal > 0 && (
                      <span className="ml-auto text-sm font-medium text-green-600 flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {newRequestsTotal.toFixed(2)}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  {newRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("admin.noNewRequests")}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>{t("admin.sitesTable.siteName")}</TableHead>
                          <TableHead>{t("admin.sitesTable.team")}</TableHead>
                          <TableHead>{t("admin.sitesTable.user")}</TableHead>
                          <TableHead>{t("admin.sitesTable.price")}</TableHead>
                          <TableHead>{t("admin.sitesTable.date")}</TableHead>
                          <TableHead>{t("admin.waiting")}</TableHead>
                          <TableHead className="w-[120px]">{t("admin.sitesTable.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {newRequests.map(item => renderRow(item))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* In Progress */}
          <Collapsible open={inProgressOpen} onOpenChange={setInProgressOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-2 px-4 cursor-pointer hover:bg-accent/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {inProgressOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Play className="h-4 w-4 text-blue-500" />
                    {t("admin.inProgressRequests")}
                    <Badge variant="secondary" className="bg-blue-500 text-white">
                      {inProgressRequests.length}
                    </Badge>
                    {inProgressTotal > 0 && (
                      <span className="ml-auto text-sm font-medium text-green-600 flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {inProgressTotal.toFixed(2)}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  {inProgressRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("admin.noInProgressRequests")}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>{t("admin.sitesTable.siteName")}</TableHead>
                          <TableHead>{t("admin.sitesTable.team")}</TableHead>
                          <TableHead>{t("admin.sitesTable.user")}</TableHead>
                          <TableHead>{t("admin.sitesTable.price")}</TableHead>
                          <TableHead>{t("admin.assignedAdmin")}</TableHead>
                          <TableHead>{t("admin.sitesTable.date")}</TableHead>
                          <TableHead>{t("admin.waitTime")}</TableHead>
                          <TableHead>{t("admin.inWork")}</TableHead>
                          <TableHead className="w-[100px]">{t("admin.sitesTable.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inProgressRequests.map(item => renderRow(item, true))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Completed */}
          <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-2 px-4 cursor-pointer hover:bg-accent/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {completedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {t("admin.completedRequests")}
                    <Badge variant="secondary" className="bg-green-500 text-white">
                      {completedRequests.length}
                    </Badge>
                    {completedTotal > 0 && (
                      <span className="ml-auto text-sm font-medium text-green-600 flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {completedTotal.toFixed(2)}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  {completedRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("admin.noCompletedRequests")}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>{t("admin.sitesTable.siteName")}</TableHead>
                          <TableHead>{t("admin.sitesTable.team")}</TableHead>
                          <TableHead>{t("admin.sitesTable.user")}</TableHead>
                          <TableHead>{t("admin.sitesTable.price")}</TableHead>
                          <TableHead>{t("admin.assignedAdmin")}</TableHead>
                          <TableHead>{t("admin.sitesTable.date")}</TableHead>
                          <TableHead>{t("admin.waitTime")}</TableHead>
                          <TableHead>{t("admin.workTime")}</TableHead>
                          <TableHead>{t("admin.totalTime")}</TableHead>
                          <TableHead className="w-[60px]">{t("admin.sitesTable.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completedRequests.map(item => renderRow(item, true))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hand className="h-5 w-5" />
              {detailsItem?.site_name || `Site ${detailsItem?.number}`}
            </DialogTitle>
          </DialogHeader>
          
          {detailsItem && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesTable.team")}</span>
                  <p className="font-medium">{getTeamName(detailsItem.team_id)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesTable.user")}</span>
                  <p className="font-medium">{getUserName(detailsItem.user_id)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.assignedAdmin")}</span>
                  <p className="font-medium text-blue-600">{getUserName(detailsItem.assigned_admin_id)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesTable.type")}</span>
                  <p className="font-medium">{detailsItem.website_type?.toUpperCase() || "HTML"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("admin.sitesDetails.prompt")}</Label>
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {detailsItem.prompt}
                </div>
              </div>

              {detailsItem.vip_prompt && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t("admin.sitesDetails.vipPrompt")}</Label>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-md text-sm whitespace-pre-wrap border border-purple-200 dark:border-purple-800">
                    {detailsItem.vip_prompt}
                  </div>
                </div>
              )}

              {/* VIP Note from buyer */}
              {detailsItem.admin_note && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    📝 {t("admin.sitesDetails.buyerNote") || "Примітка від баєра"}
                  </Label>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md text-sm whitespace-pre-wrap border border-yellow-200 dark:border-yellow-800">
                    {detailsItem.admin_note}
                  </div>
                </div>
              )}

              {/* VIP Images */}
              {detailsItem.vip_images && Array.isArray(detailsItem.vip_images) && detailsItem.vip_images.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    🖼️ {t("admin.sitesDetails.vipImages") || "Зображення для сайту"} ({(detailsItem.vip_images as string[]).length})
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(detailsItem.vip_images as string[]).map((url, idx) => (
                      <a 
                        key={idx} 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                      >
                        <img 
                          src={url} 
                          alt={`VIP image ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              {t("admin.sitesDetails.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              {t("admin.uploadResult")}
            </DialogTitle>
            <DialogDescription>
              {uploadItem?.site_name || `Site ${uploadItem?.number}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("admin.salePrice")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={uploadPrice}
                onChange={(e) => setUploadPrice(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.uploadZip")} *</Label>
              <Input
                type="file"
                accept=".zip"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              {uploadFile && (
                <p className="text-xs text-green-600">✓ {uploadFile.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("admin.adminNote")}</Label>
              <Textarea
                value={uploadNote}
                onChange={(e) => setUploadNote(e.target.value)}
                placeholder={t("admin.adminNotePlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleCompleteRequest} 
              disabled={!uploadFile || uploading}
              className="bg-green-500 hover:bg-green-600"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t("admin.complete")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              {t("admin.cancelRequestTitle")}
            </DialogTitle>
            <DialogDescription>
              {cancelItem?.site_name || `Site ${cancelItem?.number}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("admin.cancelReason")}</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("admin.cancelReasonPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("admin.cancelReasonOptional")}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleCancelRequest} disabled={cancelling}>
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  {t("admin.confirmCancel")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
