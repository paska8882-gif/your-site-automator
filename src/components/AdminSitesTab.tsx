import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { SiteEditor } from "@/components/SiteEditor";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getLanguageLabel, LANGUAGES_MAP } from "@/lib/filterConstants";
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
  Users,
  FileCode,
  Filter,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Eye,
  Pencil,
  Upload,
  Plus,
  Hand,
  Play,
  CalendarIcon,
  X
} from "lucide-react";

interface GeneratedFile {
  path: string;
  content: string;
}

type SortColumn = "site_name" | "team" | "user" | "language" | "website_type" | "ai_model" | "created_at" | "status";
type SortDirection = "asc" | "desc";

interface GenerationItem {
  id: string;
  number: number;
  prompt: string;
  improved_prompt: string | null;
  vip_prompt: string | null;
  language: string;
  created_at: string;
  completed_at: string | null;
  zip_data?: string | null;
  files_data?: unknown;
  website_type: string | null;
  site_name: string | null;
  status: string;
  error_message: string | null;
  ai_model: string | null;
  user_id: string | null;
  team_id: string | null;
  sale_price: number | null;
  admin_note: string | null;
}

// Helper function to parse retry count from admin_note
function getRetryCount(adminNote: string | null): number {
  if (!adminNote) return 0;
  const match = adminNote.match(/retry:(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Helper function to calculate and format generation duration
function getGenerationDuration(createdAt: string, completedAt: string | null): { text: string; colorClass: string } | null {
  if (!completedAt) return null;
  
  const start = new Date(createdAt).getTime();
  const end = new Date(completedAt).getTime();
  const durationMs = end - start;
  
  if (durationMs < 0) return null;
  
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  
  let text: string;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    text = `${hours}г ${mins}хв`;
  } else if (minutes > 0) {
    text = `${minutes}хв ${seconds}с`;
  } else {
    text = `${seconds}с`;
  }
  
  // Color coding: <5min green, 5-10min yellow, 10+ red
  let colorClass: string;
  if (minutes < 5) {
    colorClass = "text-green-500";
  } else if (minutes < 10) {
    colorClass = "text-yellow-500";
  } else {
    colorClass = "text-red-500";
  }
  
  return { text, colorClass };
}

interface UserProfile {
  user_id: string;
  display_name: string | null;
}

interface UserRoleInfo {
  role: string;
}

interface UserRoleMap {
  [userId: string]: UserRoleInfo | null;
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
  generation_cost_junior: number;
  generation_cost_senior: number;
}

interface ExternalUploadForm {
  teamId: string;
  siteName: string;
  prompt: string;
  language: string;
  websiteType: string;
  aiModel: string;
  salePrice: number;
  generationCost: number;
}

interface ManualRequestUploadForm {
  generationId: string;
  salePrice: number;
  adminNote: string;
}

const PAGE_SIZE_OPTIONS = [50, 100, 500] as const;

// Fetch functions for React Query
const fetchGenerationsData = async (page: number, pageSize: number) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  
  // First get total count
  const { count: totalCount, error: countError } = await supabase
    .from("generation_history")
    .select("*", { count: "exact", head: true });
  
  if (countError) throw countError;
  
  const { data, error } = await supabase
    .from("generation_history")
    .select("id, number, prompt, improved_prompt, vip_prompt, language, created_at, completed_at, website_type, site_name, status, error_message, ai_model, user_id, team_id, sale_price, admin_note, color_scheme, layout_style")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  
  const generations = data || [];
  const userIds = [...new Set(generations.map(item => item.user_id).filter(Boolean))] as string[];
  const teamIds = [...new Set(generations.map(item => item.team_id).filter(Boolean))] as string[];
  
  let profilesMap: Record<string, UserProfile> = {};
  let rolesMap: UserRoleMap = {};
  let teamsNameMap: Record<string, string> = {};
  
  // Fetch user profiles and roles in parallel
  if (userIds.length > 0) {
    const [profilesRes, membershipsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
      supabase.from("team_members").select("user_id, role").in("user_id", userIds).eq("status", "approved")
    ]);
    
    (profilesRes.data || []).forEach(profile => {
      profilesMap[profile.user_id] = profile;
    });
    
    (membershipsRes.data || []).forEach(m => {
      rolesMap[m.user_id] = { role: m.role };
    });
  }
  
  // Fetch team names
  if (teamIds.length > 0) {
    const { data: teamsData } = await supabase.from("teams").select("id, name").in("id", teamIds);
    (teamsData || []).forEach(t => {
      teamsNameMap[t.id] = t.name;
    });
  }
  
  return { 
    generations, 
    profilesMap, 
    rolesMap, 
    teamsNameMap, 
    totalCount: totalCount || 0
    // totalPages calculated in component based on dynamic pageSize
  };
};

const fetchTeamsData = async () => {
  const [teamsRes, pricingsRes] = await Promise.all([
    supabase.from("teams").select("id, name, balance").order("name"),
    supabase.from("team_pricing").select("team_id, html_price, react_price, generation_cost_junior, generation_cost_senior")
  ]);
  return { teams: teamsRes.data || [], pricings: pricingsRes.data || [] };
};

interface AdminSitesTabProps {
  filterManualOnly?: boolean;
}

export const AdminSitesTab = ({ filterManualOnly = false }: AdminSitesTabProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<GenerationItem | null>(null);
  const [previewFiles, setPreviewFiles] = useState<GeneratedFile[]>([]);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<GeneratedFile | null>(null);
  
  // Details dialog state (for viewing prompts)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<GenerationItem | null>(null);
  
  // External upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState<ExternalUploadForm>({
    teamId: "",
    siteName: "",
    prompt: "",
    language: "uk",
    websiteType: "html",
    aiModel: "senior",
    salePrice: 0,
    generationCost: 0
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Manual request upload dialog state
  const [manualUploadDialogOpen, setManualUploadDialogOpen] = useState(false);
  const [manualUploadItem, setManualUploadItem] = useState<GenerationItem | null>(null);
  const [manualUploadForm, setManualUploadForm] = useState<ManualRequestUploadForm>({
    generationId: "",
    salePrice: 0,
    adminNote: ""
  });
  const [manualUploadFile, setManualUploadFile] = useState<File | null>(null);
  const [manualUploading, setManualUploading] = useState(false);
  
  // Details dialog inline upload state
  const [detailsUploadFile, setDetailsUploadFile] = useState<File | null>(null);
  const [detailsUploadPrice, setDetailsUploadPrice] = useState<number>(0);
  const [detailsUploadNote, setDetailsUploadNote] = useState<string>("");
  const [detailsUploading, setDetailsUploading] = useState(false);
  
  // Cancel request dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelItem, setCancelItem] = useState<GenerationItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [aiModelFilter, setAiModelFilter] = useState<string>("all");
  const [websiteTypeFilter, setWebsiteTypeFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  // Date filters
  type DatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  
  // Pagination state with localStorage persistence
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('admin-sites-page-size');
    return saved ? Number(saved) : 50;
  });
  
  // Save page size to localStorage when it changes
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0);
    localStorage.setItem('admin-sites-page-size', newSize.toString());
  };

  // React Query for generations data with 5 minute cache
  const { data: generationsData, isLoading: loading, refetch: refetchGenerations } = useQuery({
    queryKey: ["admin-generations", currentPage, pageSize],
    queryFn: () => fetchGenerationsData(currentPage, pageSize),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // React Query for teams data with longer cache
  const { data: teamsData } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: fetchTeamsData,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  const history = generationsData?.generations || [];
  const profiles = generationsData?.profilesMap || {};
  const userRoles = generationsData?.rolesMap || {};
  const teamsMap = generationsData?.teamsNameMap || {};
  const totalCount = generationsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const teams = teamsData?.teams || [];
  const teamPricings = teamsData?.pricings || [];

  // Auto-fill prices when team or website type changes
  useEffect(() => {
    if (uploadForm.teamId) {
      const pricing = teamPricings.find(p => p.team_id === uploadForm.teamId);
      if (pricing) {
        const salePrice = uploadForm.websiteType === "react" ? pricing.react_price : pricing.html_price;
        const generationCost = uploadForm.aiModel === "senior" ? pricing.generation_cost_senior : pricing.generation_cost_junior;
        setUploadForm(prev => ({ ...prev, salePrice, generationCost }));
      }
    }
  }, [uploadForm.teamId, uploadForm.websiteType, uploadForm.aiModel, teamPricings]);

  const fetchAllGenerations = () => {
    refetchGenerations();
  };

  const fetchTeams = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
  };

  const handleExternalUpload = async () => {
    if (!uploadFile || !uploadForm.teamId || !uploadForm.prompt || !uploadForm.siteName) {
      toast.error("Заповніть всі обов'язкові поля та виберіть ZIP файл");
      return;
    }

    setUploading(true);

    try {
      // Read and parse ZIP file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(uploadFile);
      
      // Extract files from ZIP
      const filesData: GeneratedFile[] = [];
      const filePromises: Promise<void>[] = [];
      
      zipContent.forEach((relativePath, file) => {
        if (!file.dir) {
          filePromises.push(
            file.async("string").then(content => {
              filesData.push({
                path: relativePath,
                content: content
              });
            })
          );
        }
      });
      
      await Promise.all(filePromises);

      // Convert ZIP to base64
      const arrayBuffer = await uploadFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const zipBase64 = btoa(binary);

      // Get the team to find owner
      const selectedTeam = teams.find(t => t.id === uploadForm.teamId);
      if (!selectedTeam) {
        toast.error("Команда не знайдена");
        setUploading(false);
        return;
      }

      // Get team owner
      const { data: ownerData } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", uploadForm.teamId)
        .eq("role", "owner")
        .eq("status", "approved")
        .single();

      const ownerId = ownerData?.user_id || null;

      // Create generation history record
      const now = new Date().toISOString();
      const { error: insertError } = await supabase
        .from("generation_history")
        .insert([{
          prompt: uploadForm.prompt,
          site_name: uploadForm.siteName,
          language: uploadForm.language,
          website_type: uploadForm.websiteType,
          ai_model: uploadForm.aiModel,
          sale_price: uploadForm.salePrice,
          generation_cost: uploadForm.generationCost,
          team_id: uploadForm.teamId,
          user_id: ownerId,
          status: "completed",
          files_data: filesData as unknown as null,
          zip_data: zipBase64,
          completed_at: now,
          image_source: "external"
        }]);

      if (insertError) throw insertError;

      // Update team balance (deduct sale_price)
      if (uploadForm.salePrice > 0) {
        const { error: balanceError } = await supabase
          .from("teams")
          .update({ balance: selectedTeam.balance - uploadForm.salePrice })
          .eq("id", uploadForm.teamId);

        if (balanceError) throw balanceError;

        // Create balance transaction record
        await supabase
          .from("balance_transactions")
          .insert({
            team_id: uploadForm.teamId,
            amount: -uploadForm.salePrice,
            balance_before: selectedTeam.balance,
            balance_after: selectedTeam.balance - uploadForm.salePrice,
            note: `Зовнішня генерація: ${uploadForm.siteName}`,
            admin_id: user?.id || ""
          });
      }

      toast.success("Сайт успішно завантажено в історію");
      setUploadDialogOpen(false);
      setUploadForm({
        teamId: "",
        siteName: "",
        prompt: "",
        language: "uk",
        websiteType: "html",
        aiModel: "senior",
        salePrice: 0,
        generationCost: 0
      });
      setUploadFile(null);
      fetchAllGenerations();
      fetchTeams();
    } catch (error) {
      console.error("Error uploading external generation:", error);
      toast.error("Помилка при завантаженні");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (item: GenerationItem) => {
    // Fetch zip_data on demand
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
    const siteName = item.site_name || `site-${item.number}`;
    const lang = item.language || "en";
    const type = item.website_type || "html";
    const model = item.ai_model || "junior";
    a.download = `${siteName}-${lang}-${type}-${model}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePreview = async (item: GenerationItem) => {
    // Fetch files_data on demand
    const { data, error } = await supabase
      .from("generation_history")
      .select("files_data")
      .eq("id", item.id)
      .single();
    
    if (error || !data?.files_data) {
      toast.error("Не вдалося завантажити превью");
      return;
    }
    
    const filesData = data.files_data as unknown as GeneratedFile[];
    if (filesData && filesData.length > 0) {
      setPreviewFiles(filesData);
      setSelectedPreviewFile(filesData[0]);
      setPreviewItem(item);
      setPreviewOpen(true);
    }
  };

  const handleEdit = (item: GenerationItem) => {
    navigate(`/edit/${item.id}`);
  };

  const getStatusIcon = (status: string, salePrice?: number | null) => {
    // Check if this is a refunded failed generation
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return <RefreshCw className="h-4 w-4 text-amber-500" />;
    }
    
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "pending":
      case "generating":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "manual_request":
        return <Hand className="h-4 w-4 text-purple-500" />;
      case "manual_in_progress":
        return <Play className="h-4 w-4 text-blue-500" />;
      case "manual_completed":
        return <CheckCircle2 className="h-4 w-4 text-purple-500" />;
      case "manual_cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, salePrice?: number | null) => {
    // Check if this is a refunded failed generation
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return <Badge variant="destructive">{t("admin.sitesStatus.failedRefunded")}</Badge>;
    }
    
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">{t("admin.sitesStatus.completed")}</Badge>;
      case "failed":
        return <Badge variant="destructive">{t("admin.sitesStatus.failed")}</Badge>;
      case "pending":
        return <Badge variant="secondary">{t("admin.sitesStatus.pending")}</Badge>;
      case "generating":
        return <Badge variant="secondary" className="bg-yellow-500 text-black">{t("admin.sitesStatus.generating")}</Badge>;
      case "manual_request":
        return <Badge variant="secondary" className="bg-purple-500 text-white">{t("admin.manualRequest")}</Badge>;
      case "manual_in_progress":
        return <Badge variant="secondary" className="bg-blue-500 text-white">{t("admin.manualRequestInWork")}</Badge>;
      case "manual_completed":
        return <Badge variant="secondary" className="bg-purple-600 text-white">✋ {t("admin.sitesStatus.completed")}</Badge>;
      case "manual_cancelled":
        return <Badge variant="secondary" className="bg-red-500 text-white">✋ {t("admin.cancelled")}</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-gray-500 text-white">{t("admin.cancelled")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Take manual request in progress
  const handleTakeInWork = async (item: GenerationItem) => {
    try {
      const { error } = await supabase
        .from("generation_history")
        .update({ status: "manual_in_progress" })
        .eq("id", item.id);

      if (error) throw error;
      
      toast.success(t("admin.manualRequestTaken"));
      fetchAllGenerations();
    } catch (error) {
      console.error("Error taking manual request:", error);
      toast.error(t("common.error"));
    }
  };

  // Cancel manual request
  const handleCancelRequest = async () => {
    if (!cancelItem) return;

    setCancelling(true);
    try {
      const { error } = await supabase
        .from("generation_history")
        .update({ 
          status: "cancelled",
          error_message: cancelReason || null,
          completed_at: new Date().toISOString()
        })
        .eq("id", cancelItem.id);

      if (error) throw error;
      
      toast.success(t("admin.requestCancelled"));
      setCancelDialogOpen(false);
      setCancelItem(null);
      setCancelReason("");
      fetchAllGenerations();
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast.error(t("common.error"));
    } finally {
      setCancelling(false);
    }
  };

  // Open cancel dialog
  const handleOpenCancelDialog = (item: GenerationItem) => {
    setCancelItem(item);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  // Open manual upload dialog
  const handleOpenManualUpload = (item: GenerationItem) => {
    // Get team pricing for default sale price
    const pricing = item.team_id ? teamPricings.find(p => p.team_id === item.team_id) : null;
    const defaultPrice = pricing 
      ? (item.website_type === "react" ? pricing.react_price : pricing.html_price)
      : 0;

    setManualUploadItem(item);
    setManualUploadForm({
      generationId: item.id,
      salePrice: defaultPrice,
      adminNote: ""
    });
    setManualUploadFile(null);
    setManualUploadDialogOpen(true);
  };

  // Complete manual request with uploaded ZIP
  const handleCompleteManualRequest = async () => {
    console.log("handleCompleteManualRequest called", { manualUploadFile, manualUploadItem });
    if (!manualUploadFile || !manualUploadItem) {
      console.log("Validation failed", { hasFile: !!manualUploadFile, hasItem: !!manualUploadItem });
      toast.error(t("admin.fillAllFields"));
      return;
    }

    setManualUploading(true);

    try {
      // Read and parse ZIP file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(manualUploadFile);
      
      // Extract only text files from ZIP (skip binary files like images)
      const textExtensions = ['.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.xml', '.svg', '.txt', '.md', '.php'];
      const filesData: GeneratedFile[] = [];
      const filePromises: Promise<void>[] = [];
      
      zipContent.forEach((relativePath, file) => {
        if (!file.dir) {
          const ext = relativePath.toLowerCase().substring(relativePath.lastIndexOf('.'));
          if (textExtensions.includes(ext)) {
            filePromises.push(
              file.async("text").then(content => {
                filesData.push({
                  path: relativePath,
                  content: content
                });
              }).catch(() => {
                // Skip files that can't be read as text
              })
            );
          }
        }
      });
      
      await Promise.all(filePromises);

      // Convert ZIP to base64
      const arrayBuffer = await manualUploadFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const zipBase64 = btoa(binary);

      const now = new Date().toISOString();

      // Prepare files_data as proper JSON array
      const filesDataJson = filesData.length > 0 ? (filesData as unknown as null) : null;
      console.log("Updating generation record", { id: manualUploadItem.id, filesCount: filesData.length });

      // Update generation record
      const { error: updateError } = await supabase
        .from("generation_history")
        .update({
          status: "completed",
          files_data: filesDataJson,
          zip_data: zipBase64,
          completed_at: now,
          sale_price: manualUploadForm.salePrice,
          admin_note: manualUploadForm.adminNote || null,
          image_source: "manual"
        })
        .eq("id", manualUploadItem.id);

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }
      console.log("Generation record updated successfully");

      // Update team balance if there's a sale price
      if (manualUploadForm.salePrice > 0 && manualUploadItem.team_id) {
        const team = teams.find(t => t.id === manualUploadItem.team_id);
        if (team) {
          const { error: balanceError } = await supabase
            .from("teams")
            .update({ balance: team.balance - manualUploadForm.salePrice })
            .eq("id", manualUploadItem.team_id);

          if (balanceError) throw balanceError;

          // Create balance transaction record
          await supabase
            .from("balance_transactions")
            .insert({
              team_id: manualUploadItem.team_id,
              amount: -manualUploadForm.salePrice,
              balance_before: team.balance,
              balance_after: team.balance - manualUploadForm.salePrice,
              note: `Ручна генерація: ${manualUploadItem.site_name || `Site ${manualUploadItem.number}`}`,
              admin_id: user?.id || ""
            });
        }
      }

      toast.success(t("admin.manualRequestCompleted"));
      setManualUploadDialogOpen(false);
      setManualUploadItem(null);
      setManualUploadFile(null);
      fetchAllGenerations();
      fetchTeams();
    } catch (error) {
      console.error("Error completing manual request:", error);
      toast.error(t("admin.uploadError"));
    } finally {
      setManualUploading(false);
    }
  };

  // Complete manual request from details dialog
  const handleCompleteFromDetails = async () => {
    console.log("handleCompleteFromDetails called", { detailsUploadFile, detailsItem, detailsUploadPrice });
    if (!detailsUploadFile || !detailsItem) {
      console.log("Validation failed", { hasFile: !!detailsUploadFile, hasItem: !!detailsItem });
      toast.error(t("admin.fillAllFields"));
      return;
    }

    setDetailsUploading(true);

    try {
      // Read and parse ZIP file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(detailsUploadFile);
      
      // Extract only text files from ZIP (skip binary files like images)
      const textExtensions = ['.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.xml', '.svg', '.txt', '.md', '.php'];
      const filesData: GeneratedFile[] = [];
      const filePromises: Promise<void>[] = [];
      
      zipContent.forEach((relativePath, file) => {
        if (!file.dir) {
          const ext = relativePath.toLowerCase().substring(relativePath.lastIndexOf('.'));
          if (textExtensions.includes(ext)) {
            filePromises.push(
              file.async("text").then(content => {
                filesData.push({
                  path: relativePath,
                  content: content
                });
              }).catch(() => {
                // Skip files that can't be read as text
              })
            );
          }
        }
      });
      
      await Promise.all(filePromises);

      // Convert ZIP to base64
      const arrayBuffer = await detailsUploadFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const zipBase64 = btoa(binary);

      const now = new Date().toISOString();

      // Prepare files_data as proper JSON array
      const filesDataJson = filesData.length > 0 ? (filesData as unknown as null) : null;

      // Update generation record
      const { error: updateError } = await supabase
        .from("generation_history")
        .update({
          status: "completed",
          files_data: filesDataJson,
          zip_data: zipBase64,
          completed_at: now,
          sale_price: detailsUploadPrice,
          admin_note: detailsUploadNote || null,
          image_source: "manual"
        })
        .eq("id", detailsItem.id);

      if (updateError) throw updateError;

      // Update team balance if there's a sale price
      if (detailsUploadPrice > 0 && detailsItem.team_id) {
        const team = teams.find(t => t.id === detailsItem.team_id);
        if (team) {
          const { error: balanceError } = await supabase
            .from("teams")
            .update({ balance: team.balance - detailsUploadPrice })
            .eq("id", detailsItem.team_id);

          if (balanceError) throw balanceError;

          // Create balance transaction record
          await supabase
            .from("balance_transactions")
            .insert({
              team_id: detailsItem.team_id,
              amount: -detailsUploadPrice,
              balance_before: team.balance,
              balance_after: team.balance - detailsUploadPrice,
              note: `Ручна генерація: ${detailsItem.site_name || `Site ${detailsItem.number}`}`,
              admin_id: user?.id || ""
            });
        }
      }

      toast.success(t("admin.manualRequestCompleted"));
      setDetailsOpen(false);
      setDetailsItem(null);
      setDetailsUploadFile(null);
      setDetailsUploadPrice(0);
      setDetailsUploadNote("");
      fetchAllGenerations();
      fetchTeams();
    } catch (error) {
      console.error("Error completing from details:", error);
      toast.error(t("admin.uploadError"));
    } finally {
      setDetailsUploading(false);
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return t("admin.sitesAnonymous");
    const profile = profiles[userId];
    return profile?.display_name || userId.slice(0, 8) + "...";
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return "—";
    return teamsMap[teamId] || "—";
  };

  const getRoleBadge = (userId: string | null) => {
    if (!userId) return null;
    const roleInfo = userRoles[userId];
    if (!roleInfo) return null;
    
    const roleLabels: Record<string, string> = {
      owner: "Owner",
      team_lead: "Team Lead",
      buyer: "Buyer",
      tech_dev: "Tech Dev"
    };
    
    return (
      <Badge variant="outline" className="text-xs">
        {roleLabels[roleInfo.role] || roleInfo.role}
      </Badge>
    );
  };

  // Get unique values for filters
  const uniqueLanguages = [...new Set(history.map(h => h.language))].filter(Boolean);
  const uniqueUsers = [...new Set(history.map(h => h.user_id).filter(Boolean))] as string[];
  const uniqueTeams = Object.values(teamsMap);

  const filteredHistory = history.filter(item => {
    // If filterManualOnly is true, only show manual_request and manual_in_progress
    if (filterManualOnly) {
      if (item.status !== "manual_request" && item.status !== "manual_in_progress") {
        return false;
      }
    }
    
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (aiModelFilter !== "all" && (item.ai_model || "junior") !== aiModelFilter) return false;
    if (websiteTypeFilter !== "all" && (item.website_type || "html") !== websiteTypeFilter) return false;
    if (languageFilter !== "all" && item.language !== languageFilter) return false;
    if (teamFilter !== "all") {
      const teamName = getTeamName(item.team_id);
      if (teamName !== teamFilter) return false;
    }
    if (userFilter !== "all" && item.user_id !== userFilter) return false;
    
    // Date filter using presets
    if (datePreset !== "all") {
      const itemDate = new Date(item.created_at);
      const now = new Date();
      
      let from: Date | undefined;
      let to: Date | undefined;
      
      switch (datePreset) {
        case "today":
          from = startOfDay(now);
          to = endOfDay(now);
          break;
        case "yesterday":
          const yesterday = subDays(now, 1);
          from = startOfDay(yesterday);
          to = endOfDay(yesterday);
          break;
        case "week":
          from = startOfWeek(now, { weekStartsOn: 1 });
          to = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case "month":
          from = startOfMonth(now);
          to = endOfMonth(now);
          break;
        case "custom":
          from = dateFrom;
          to = dateTo;
          break;
      }
      
      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;
    }
    
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.prompt.toLowerCase().includes(query) ||
      (item.site_name && item.site_name.toLowerCase().includes(query)) ||
      getUserName(item.user_id).toLowerCase().includes(query) ||
      getTeamName(item.team_id).toLowerCase().includes(query)
    );
  });

  // Sorting logic
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (sortColumn) {
      case "site_name":
        aVal = a.site_name || `site-${a.number}`;
        bVal = b.site_name || `site-${b.number}`;
        break;
      case "team":
        aVal = getTeamName(a.team_id);
        bVal = getTeamName(b.team_id);
        break;
      case "user":
        aVal = getUserName(a.user_id);
        bVal = getUserName(b.user_id);
        break;
      case "language":
        aVal = a.language;
        bVal = b.language;
        break;
      case "website_type":
        aVal = a.website_type || "html";
        bVal = b.website_type || "html";
        break;
      case "ai_model":
        aVal = a.ai_model || "junior";
        bVal = b.ai_model || "junior";
        break;
      case "created_at":
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      case "status":
        aVal = a.status;
        bVal = b.status;
        break;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return sortDirection === "asc" 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  // Calculate average generation times for HTML and React
  const calculateAvgTime = (items: GenerationItem[]): string => {
    const completedItems = items.filter(h => h.status === "completed" && h.completed_at);
    if (completedItems.length === 0) return "—";
    
    const totalMs = completedItems.reduce((sum, item) => {
      const start = new Date(item.created_at).getTime();
      const end = new Date(item.completed_at!).getTime();
      return sum + (end - start);
    }, 0);
    
    const avgMs = totalMs / completedItems.length;
    const minutes = Math.floor(avgMs / 60000);
    const seconds = Math.floor((avgMs % 60000) / 1000);
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}г ${mins}хв`;
    } else if (minutes > 0) {
      return `${minutes}хв ${seconds}с`;
    }
    return `${seconds}с`;
  };

  const htmlGenerations = history.filter(h => (h.website_type || "html") === "html");
  const reactGenerations = history.filter(h => h.website_type === "react");

  // Calculate retry statistics
  const retryStats = history.reduce((acc, item) => {
    const retryCount = getRetryCount(item.admin_note);
    if (retryCount > 0) {
      acc.totalRetried++;
      acc.totalRetryAttempts += retryCount;
    }
    return acc;
  }, { totalRetried: 0, totalRetryAttempts: 0 });

  const stats = {
    total: history.length,
    completed: history.filter(h => h.status === "completed").length,
    failed: history.filter(h => h.status === "failed").length,
    pending: history.filter(h => h.status === "pending" || h.status === "generating").length,
    uniqueUsers: new Set(history.map(h => h.user_id).filter(Boolean)).size,
    uniqueTeams: uniqueTeams.length,
    avgTimeHtml: calculateAvgTime(htmlGenerations),
    avgTimeReact: calculateAvgTime(reactGenerations),
    htmlCount: htmlGenerations.filter(h => h.status === "completed").length,
    reactCount: reactGenerations.filter(h => h.status === "completed").length,
    retried: retryStats.totalRetried,
    retryAttempts: retryStats.totalRetryAttempts
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <AdminPageHeader 
          icon={FileCode} 
          title={t("admin.sitesTitle")} 
          description={t("admin.sitesDescription")} 
        />
        <Button
          size="sm"
          onClick={() => setUploadDialogOpen(true)}
          className="h-8"
        >
          <Upload className="h-4 w-4 mr-2" />
          {t("admin.sitesUpload.title")}
        </Button>
      </div>
      {/* Stats - compact row */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.sitesStats.total")}:</span>
          <span className="text-sm font-bold">{totalCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.sitesStats.completed")}:</span>
          <span className="text-sm font-bold text-green-500">{stats.completed}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.sitesStats.failed")}:</span>
          <span className="text-sm font-bold text-destructive">{stats.failed}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.sitesStats.inProgress")}:</span>
          <span className="text-sm font-bold text-yellow-500">{stats.pending}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.sitesStats.users")}:</span>
          <span className="text-sm font-bold">{stats.uniqueUsers}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.sitesStats.teams")}:</span>
          <span className="text-sm font-bold">{stats.uniqueTeams}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.sitesStats.avgTimeHtml")} ({stats.htmlCount}):</span>
          <span className="text-sm font-bold">{stats.avgTimeHtml}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.sitesStats.avgTimeReact")} ({stats.reactCount}):</span>
          <span className="text-sm font-bold">{stats.avgTimeReact}</span>
        </div>
        {stats.retried > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card border-orange-500/30">
            <span className="text-xs text-muted-foreground">🔄 Auto-retry:</span>
            <span className="text-sm font-bold text-orange-500" title={`${stats.retryAttempts} спроб для ${stats.retried} генерацій`}>
              {stats.retried} ({stats.retryAttempts} спроб)
            </span>
          </div>
        )}
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
            {(statusFilter !== "all" || aiModelFilter !== "all" || websiteTypeFilter !== "all" || languageFilter !== "all" || teamFilter !== "all" || userFilter !== "all" || datePreset !== "all") && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                !
              </Badge>
            )}
          </Button>

          {/* Clear Filters */}
          {(statusFilter !== "all" || aiModelFilter !== "all" || websiteTypeFilter !== "all" || languageFilter !== "all" || teamFilter !== "all" || userFilter !== "all" || datePreset !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={() => {
                setStatusFilter("all");
                setAiModelFilter("all");
                setWebsiteTypeFilter("all");
                setLanguageFilter("all");
                setTeamFilter("all");
                setUserFilter("all");
                setDatePreset("all");
                setDateFrom(undefined);
                setDateTo(undefined);
              }}
            >
              <X className="h-4 w-4 mr-1" />
              {t("admin.clearFilters")}
            </Button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {/* Team Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.sitesTable.team")}</Label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.allTeams")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.allTeams")}</SelectItem>
                    {uniqueTeams.map(team => (
                      <SelectItem key={team} value={team}>{team}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.sitesTable.user")}</Label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.allBuyers")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.allBuyers")}</SelectItem>
                    {uniqueUsers.map(userId => (
                      <SelectItem key={userId} value={userId}>{getUserName(userId)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.sitesTable.status")}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.sitesFilters.allStatuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.sitesFilters.allStatuses")}</SelectItem>
                    <SelectItem value="completed">{t("admin.sitesFilters.completed")}</SelectItem>
                    <SelectItem value="generating">{t("admin.sitesFilters.generating")}</SelectItem>
                    <SelectItem value="pending">{t("admin.sitesFilters.pending")}</SelectItem>
                    <SelectItem value="failed">{t("admin.sitesFilters.failed")}</SelectItem>
                    <SelectItem value="manual_request">{t("admin.manualRequest")}</SelectItem>
                    <SelectItem value="manual_in_progress">{t("admin.manualRequestInWork")}</SelectItem>
                    <SelectItem value="manual_completed">✋ Готово (ручний)</SelectItem>
                    <SelectItem value="manual_cancelled">✋ Скасовано (ручний)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI Model Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.sitesTable.ai")}</Label>
                <Select value={aiModelFilter} onValueChange={setAiModelFilter}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.sitesFilters.allModels")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.sitesFilters.allModels")}</SelectItem>
                    <SelectItem value="junior">Jr</SelectItem>
                    <SelectItem value="senior">Sr</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Website Type Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.sitesTable.type")}</Label>
                <Select value={websiteTypeFilter} onValueChange={setWebsiteTypeFilter}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.sitesFilters.allTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.sitesFilters.allTypes")}</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="react">React</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Language Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.sitesTable.language")}</Label>
                <Select value={languageFilter} onValueChange={setLanguageFilter}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t("admin.sitesFilters.allLanguages")}>
                      {languageFilter !== "all" ? getLanguageLabel(languageFilter) : t("admin.sitesFilters.allLanguages")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.sitesFilters.allLanguages")}</SelectItem>
                    {uniqueLanguages.map(lang => (
                      <SelectItem key={lang} value={lang}>{getLanguageLabel(lang)}</SelectItem>
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

      {/* Table */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <FileCode className="h-3.5 w-3.5" />
            {t("admin.sitesAllGenerations")} ({sortedHistory.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : sortedHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-xs">
              {searchQuery ? t("admin.sitesNothing") : t("admin.sitesEmpty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="w-[50px] cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center">
                        {t("admin.sitesTable.status")}
                        {getSortIcon("status")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("site_name")}
                    >
                      <div className="flex items-center">
                        {t("admin.sitesTable.siteName")}
                        {getSortIcon("site_name")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("team")}
                    >
                      <div className="flex items-center">
                        {t("admin.sitesTable.team")}
                        {getSortIcon("team")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("user")}
                    >
                      <div className="flex items-center">
                        {t("admin.sitesTable.user")}
                        {getSortIcon("user")}
                      </div>
                    </TableHead>
                    <TableHead>{t("admin.sitesTable.role")}</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("language")}
                    >
                      <div className="flex items-center">
                        {t("admin.sitesTable.language")}
                        {getSortIcon("language")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("website_type")}
                    >
                      <div className="flex items-center">
                        {t("admin.sitesTable.type")}
                        {getSortIcon("website_type")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("ai_model")}
                    >
                      <div className="flex items-center">
                        {t("admin.sitesTable.ai")}
                        {getSortIcon("ai_model")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("created_at")}
                    >
                      <div className="flex items-center">
                        {t("admin.sitesTable.date")}
                        {getSortIcon("created_at")}
                      </div>
                    </TableHead>
                    <TableHead>{t("admin.sitesTable.duration")}</TableHead>
                    <TableHead className="w-[80px]">{t("admin.sitesTable.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistory.map((item) => (
                    <Collapsible key={item.id} asChild>
                      <>
                        <TableRow 
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => {
                            setDetailsItem(item);
                            // Reset upload form for manual requests
                            if (item.status === "manual_request" || item.status === "manual_in_progress") {
                              const pricing = item.team_id ? teamPricings.find(p => p.team_id === item.team_id) : null;
                              const defaultPrice = pricing 
                                ? (item.website_type === "react" ? pricing.react_price : pricing.html_price)
                                : 0;
                              setDetailsUploadPrice(defaultPrice);
                              setDetailsUploadNote("");
                              setDetailsUploadFile(null);
                            }
                            setDetailsOpen(true);
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(item.status, item.sale_price)}
                              {(() => {
                                const retryCount = getRetryCount(item.admin_note);
                                if (retryCount > 0) {
                                  return (
                                    <Badge 
                                      variant="outline" 
                                      className="text-[10px] px-1 py-0 text-orange-500 border-orange-500/50"
                                      title={`Автоматично перезапущено ${retryCount} раз(и)`}
                                    >
                                      🔄{retryCount}
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1 flex-wrap">
                              {item.site_name || `Site ${item.number}`}
                              {item.vip_prompt && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-500 border-amber-500/50" title="VIP генерація">
                                  VIP
                                </Badge>
                              )}
                              {item.improved_prompt && !item.vip_prompt && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary/50" title={`Покращений промт: ${item.improved_prompt.substring(0, 200)}...`}>
                                  AI+
                                </Badge>
                              )}
                              {item.color_scheme && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-emerald-500 border-emerald-500/50" title={`Кольорова схема: ${item.color_scheme}`}>
                                  🎨 {item.color_scheme}
                                </Badge>
                              )}
                              {item.layout_style && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-violet-500 border-violet-500/50" title={`Стиль макету: ${item.layout_style}`}>
                                  📐 {item.layout_style}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {getTeamName(item.team_id)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{getUserName(item.user_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getRoleBadge(item.user_id)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getLanguageLabel(item.language)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.website_type || "html"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.ai_model === "senior" ? "default" : "outline"}>
                              {item.ai_model === "senior" ? "Senior" : "Junior"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleString("uk-UA", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </TableCell>
                          <TableCell>
                            {(item.status === "completed" || item.status === "manual_completed") && (() => {
                              const isManual = item.status === "manual_completed";
                              const duration = getGenerationDuration(item.created_at, item.completed_at);
                              if (duration) {
                                return (
                                  <Badge variant="outline" className={`text-xs ${isManual ? 'text-purple-500' : duration.colorClass}`}>
                                    {isManual ? '✋' : '⏱'} {duration.text}
                                  </Badge>
                                );
                              }
                              return <span className="text-xs text-muted-foreground">—</span>;
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {(item.status === "completed" || item.status === "manual_completed") && (
                                <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handlePreview(item)}
                                      title={t("admin.sitesPreview.title")}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleEdit(item)}
                                      title={t("admin.sitesPreview.edit")}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleDownload(item)}
                                      title={t("admin.downloadZip")}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {(item.status === "manual_request" || item.status === "manual_in_progress") && (
                                <div className="flex items-center gap-1">
                                  {item.status === "manual_request" && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 text-xs bg-purple-500 hover:bg-purple-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTakeInWork(item);
                                      }}
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      {t("admin.takeInWork")}
                                    </Button>
                                  )}
                                  {item.status === "manual_in_progress" && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 text-xs bg-green-500 hover:bg-green-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenManualUpload(item);
                                      }}
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      {t("admin.complete")}
                                    </Button>
                                  )}
                                  {/* Cancel button only for manual_request (not yet taken in work) */}
                                  {item.status === "manual_request" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCancelDialog(item);
                                      }}
                                      title={t("admin.cancelRequest")}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  Показано {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalCount)} з {totalCount} записів
                </div>
                <Select 
                  value={pageSize.toString()} 
                  onValueChange={(v) => handlePageSizeChange(Number(v))}
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <SelectItem key={size} value={size.toString()} className="text-xs">
                        {size} / стор
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0 || loading}
                >
                  ««
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0 || loading}
                >
                  «
                </Button>
                <span className="text-sm px-2">
                  Сторінка {currentPage + 1} з {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1 || loading}
                >
                  »
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1 || loading}
                >
                  »»
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview/Editor Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[1600px] h-[90vh] flex flex-col p-0">
          <div className="flex-1 overflow-hidden">
            {previewFiles.length > 0 && previewItem && (
              <SiteEditor
                generationId={previewItem.id}
                initialFiles={previewFiles}
                aiModel={(previewItem.ai_model as "junior" | "senior") || "senior"}
                websiteType={(previewItem.website_type as "html" | "react") || "html"}
                originalPrompt={previewItem.prompt}
                onFilesChange={(newFiles) => {
                  setPreviewFiles(newFiles);
                }}
                header={
                  <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Eye className="h-4 w-4" />
                      {previewItem?.site_name || `Site ${previewItem?.number}`}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* External Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("admin.sitesUpload.title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.sitesUpload.description")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("admin.sitesUpload.team")} *</Label>
              <Select
                value={uploadForm.teamId}
                onValueChange={(value) => setUploadForm(prev => ({ ...prev, teamId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.sitesUpload.selectTeam")} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} ({t("admin.sitesUpload.balance")}: ${team.balance.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.sitesUpload.siteName")} *</Label>
              <Input
                value={uploadForm.siteName}
                onChange={(e) => setUploadForm(prev => ({ ...prev, siteName: e.target.value }))}
                placeholder={t("admin.sitesUpload.siteName")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.sitesUpload.prompt")} *</Label>
              <Textarea
                value={uploadForm.prompt}
                onChange={(e) => setUploadForm(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder={t("admin.sitesUpload.promptPlaceholder")}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.sitesUpload.language")}</Label>
                <Select
                  value={uploadForm.language}
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, language: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uk">Українська</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="pl">Polski</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("admin.sitesUpload.websiteType")}</Label>
                <Select
                  value={uploadForm.websiteType}
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, websiteType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="react">React</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.sitesUpload.aiModel")}</Label>
                <Select
                  value={uploadForm.aiModel}
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, aiModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("admin.sitesUpload.salePrice")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={uploadForm.salePrice}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
                {uploadForm.teamId && (() => {
                  const pricing = teamPricings.find(p => p.team_id === uploadForm.teamId);
                  if (pricing) {
                    const standardPrice = uploadForm.websiteType === "react" ? pricing.react_price : pricing.html_price;
                    return (
                      <p className="text-xs text-muted-foreground">
                        {t("admin.sitesUpload.salePriceStandard")} {uploadForm.websiteType.toUpperCase()}: <span className="font-medium">${standardPrice.toFixed(2)}</span> ({t("admin.sitesUpload.fromTeamTariffs")})
                      </p>
                    );
                  }
                  return <p className="text-xs text-amber-500">{t("admin.sitesUpload.teamTariffsNotSet")}</p>;
                })()}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.sitesUpload.generationCost")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={uploadForm.generationCost}
                onChange={(e) => setUploadForm(prev => ({ ...prev, generationCost: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
              {uploadForm.teamId && (() => {
                const pricing = teamPricings.find(p => p.team_id === uploadForm.teamId);
                if (pricing) {
                  const standardCost = uploadForm.aiModel === "senior" ? pricing.generation_cost_senior : pricing.generation_cost_junior;
                  return (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.sitesUpload.generationCostStandard")} {uploadForm.aiModel === "senior" ? "Senior" : "Junior"}: <span className="font-medium">${standardCost.toFixed(2)}</span> ({t("admin.sitesUpload.fromTeamTariffs")})
                    </p>
                  );
                }
                return null;
              })()}
              <p className="text-xs text-muted-foreground">
                {t("admin.sitesUpload.generationCostNote")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.sitesUpload.zipFile")} *</Label>
              <Input
                type="file"
                accept=".zip"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {t("admin.sitesUpload.selected")}: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading}
            >
              {t("admin.sitesUpload.cancel")}
            </Button>
            <Button
              onClick={handleExternalUpload}
              disabled={uploading || !uploadFile || !uploadForm.teamId || !uploadForm.prompt || !uploadForm.siteName}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("admin.sitesUpload.uploading")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("admin.sitesUpload.upload")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog - Shows both prompts */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {t("admin.sitesDetails.title")}: {detailsItem?.site_name || `Site ${detailsItem?.number}`}
            </DialogTitle>
          </DialogHeader>
          
          {detailsItem && (
            <div className="space-y-4 py-4">
              {/* General info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesDetails.status")}</span>
                  <div className="flex items-center gap-1 mt-1">
                    {getStatusIcon(detailsItem.status, detailsItem.sale_price)}
                    <span className="font-medium">
                      {detailsItem.status === "completed" ? t("admin.sitesDetails.statusCompleted") :
                       detailsItem.status === "generating" ? t("admin.sitesDetails.statusGenerating") :
                       detailsItem.status === "pending" ? t("admin.sitesDetails.statusPending") :
                       detailsItem.status === "manual_request" ? t("admin.manualRequest") :
                       detailsItem.status === "manual_in_progress" ? t("admin.manualRequestInWork") :
                       detailsItem.status === "manual_completed" ? `✋ ${t("admin.sitesDetails.statusCompleted")}` :
                       detailsItem.status === "manual_cancelled" ? `✋ ${t("admin.cancelled")}` :
                       t("admin.sitesDetails.statusFailed")}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesDetails.aiModel")}</span>
                  <p className="font-medium">{detailsItem.ai_model === "senior" ? "Senior" : "Junior"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesDetails.type")}</span>
                  <p className="font-medium">{detailsItem.website_type === "react" ? "React" : "HTML"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesDetails.language")}</span>
                  <p className="font-medium">{getLanguageLabel(detailsItem.language)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesDetails.team")}</span>
                  <p className="font-medium">{getTeamName(detailsItem.team_id)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesDetails.user")}</span>
                  <p className="font-medium">{getUserName(detailsItem.user_id)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesDetails.date")}</span>
                  <p className="font-medium">{new Date(detailsItem.created_at).toLocaleString("uk-UA")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("admin.sitesDetails.salePrice")}</span>
                  <p className="font-medium">${detailsItem.sale_price || 0}</p>
                </div>
              </div>

              {/* Original prompt from client */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t("admin.sitesDetails.clientPrompt")}</Label>
                <div className="p-3 rounded-md bg-muted/50 border text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {detailsItem.prompt}
                </div>
              </div>

              {/* Improved prompt (commercial secret) */}
              {detailsItem.improved_prompt && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    {t("admin.sitesDetails.improvedPrompt")}
                    <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary/50">
                      AI+
                    </Badge>
                  </Label>
                  <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {detailsItem.improved_prompt}
                  </div>
                </div>
              )}

              {/* VIP prompt (commercial secret) */}
              {detailsItem.vip_prompt && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    {t("admin.sitesDetails.vipPrompt")}
                    <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-500 border-amber-500/50 bg-amber-500/10">
                      VIP
                    </Badge>
                  </Label>
                  <div className="p-3 rounded-md bg-amber-500/5 border border-amber-500/20 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {detailsItem.vip_prompt}
                  </div>
                </div>
              )}

              {/* Error message if failed */}
              {detailsItem.error_message && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-destructive">{t("admin.sitesDetails.error")}</Label>
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {detailsItem.error_message}
                  </div>
                </div>
              )}

              {/* Upload form for manual requests */}
              {(detailsItem.status === "manual_request" || detailsItem.status === "manual_in_progress") && (
                <div className="space-y-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Upload className="h-5 w-5" />
                    <span className="font-semibold">{t("admin.uploadResult")}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">{t("admin.salePrice")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={detailsUploadPrice}
                        onChange={(e) => setDetailsUploadPrice(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      {detailsItem.team_id && (() => {
                        const pricing = teamPricings.find(p => p.team_id === detailsItem.team_id);
                        if (pricing) {
                          const standardPrice = detailsItem.website_type === "react" ? pricing.react_price : pricing.html_price;
                          return (
                            <p className="text-xs text-muted-foreground">
                              {t("admin.sitesUpload.salePriceStandard")} {(detailsItem.website_type || "html").toUpperCase()}: <span className="font-medium">${standardPrice.toFixed(2)}</span>
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">{t("admin.uploadZip")} *</Label>
                      <Input
                        type="file"
                        accept=".zip"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          console.log("File selected:", file?.name, file?.size);
                          setDetailsUploadFile(file);
                        }}
                      />
                      {detailsUploadFile && (
                        <p className="text-xs text-green-600">{detailsUploadFile.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">{t("admin.adminNote")}</Label>
                    <Textarea
                      value={detailsUploadNote}
                      onChange={(e) => setDetailsUploadNote(e.target.value)}
                      placeholder={t("admin.adminNotePlaceholder")}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCompleteFromDetails} 
                      disabled={!detailsUploadFile || detailsUploading}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      {detailsUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t("common.loading")}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {t("admin.completeAndUpload")}
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        setDetailsOpen(false);
                        handleOpenCancelDialog(detailsItem);
                      }}
                      disabled={detailsUploading}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {t("admin.cancelRequest")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              {t("admin.sitesDetails.close")}
            </Button>
            {detailsItem?.status === "completed" && detailsItem?.files_data && (
              <Button onClick={() => {
                setDetailsOpen(false);
                handlePreview(detailsItem);
              }}>
                <Eye className="h-4 w-4 mr-2" />
                {t("admin.sitesDetails.preview")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Request Upload Dialog */}
      <Dialog open={manualUploadDialogOpen} onOpenChange={setManualUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("admin.uploadResult")}
            </DialogTitle>
            <DialogDescription>
              {manualUploadItem?.site_name || `Site ${manualUploadItem?.number}`} — {manualUploadItem?.prompt?.slice(0, 100)}...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("admin.salePrice")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={manualUploadForm.salePrice}
                onChange={(e) => setManualUploadForm(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
              {manualUploadItem?.team_id && (() => {
                const pricing = teamPricings.find(p => p.team_id === manualUploadItem.team_id);
                if (pricing) {
                  const standardPrice = manualUploadItem.website_type === "react" ? pricing.react_price : pricing.html_price;
                  return (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.sitesUpload.salePriceStandard")} {(manualUploadItem.website_type || "html").toUpperCase()}: <span className="font-medium">${standardPrice.toFixed(2)}</span>
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div className="space-y-2">
              <Label>{t("admin.uploadZip")} *</Label>
              <Input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  console.log("Manual upload file selected:", file?.name, file?.size);
                  setManualUploadFile(file);
                }}
              />
              {manualUploadFile && (
                <p className="text-xs text-green-600">✓ {manualUploadFile.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("admin.adminNote")}</Label>
              <Textarea
                value={manualUploadForm.adminNote}
                onChange={(e) => setManualUploadForm(prev => ({ ...prev, adminNote: e.target.value }))}
                placeholder={t("admin.adminNotePlaceholder")}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualUploadDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleCompleteManualRequest} 
              disabled={!manualUploadFile || manualUploading}
            >
              {manualUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t("admin.upload")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Request Dialog */}
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
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">{t("admin.cancelReasonOptional")}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
              {t("common.cancel")}
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCancelRequest} 
              disabled={cancelling}
            >
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
};
