import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import JSZip from "jszip";
import { 
  ArrowLeft, 
  Users, 
  Wallet, 
  Calendar, 
  UserCog,
  TrendingUp,
  TrendingDown,
  Download,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Crown,
  Shield,
  ShoppingCart,
  Code,
  Clock,
  BarChart3,
  FileText,
  AlertTriangle,
  Save,
  Edit,
  Upload
} from "lucide-react";
import { BuyerGenerationsAnalytics } from "@/components/BuyerGenerationsAnalytics";
import { TeamFinanceManager } from "@/components/admin/TeamFinanceManager";

interface Team {
  id: string;
  name: string;
  balance: number;
  credit_limit: number;
  max_referral_invites: number;
  created_at: string;
  created_by: string;
  assigned_admin_ids: string[];
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  display_name: string | null;
  email?: string;
}

interface Admin {
  user_id: string;
  display_name: string | null;
}

interface Generation {
  id: string;
  site_name: string | null;
  sale_price: number | null;
  generation_cost: number | null;
  created_at: string;
  status: string;
  website_type: string | null;
  ai_model: string | null;
  user_id: string | null;
  user_name?: string;
}

interface BalanceTransaction {
  id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  note: string;
  created_at: string;
  admin_name?: string;
}

interface TeamPricing {
  id: string;
  html_price: number;
  react_price: number;
  generation_cost_junior: number;
  generation_cost_senior: number;
  external_price: number | null;
  manual_price: number | null;
}

interface Appeal {
  id: string;
  reason: string;
  status: string;
  amount_to_refund: number;
  created_at: string;
  resolved_at: string | null;
  admin_comment: string | null;
  user_id: string;
  generation_id: string;
  user_name?: string;
  site_name?: string;
}

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  team_lead: Shield,
  buyer: ShoppingCart,
  tech_dev: Code
};

const roleLabels: Record<string, string> = {
  owner: "Власник",
  team_lead: "Тімлід",
  buyer: "Баєр",
  tech_dev: "Техдев"
};

const AdminTeamDetails = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [pricing, setPricing] = useState<TeamPricing | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingCreditLimit, setSavingCreditLimit] = useState(false);
  const [creditLimitInput, setCreditLimitInput] = useState("");
  const [referralLimitInput, setReferralLimitInput] = useState("4");
  const [savingReferralLimit, setSavingReferralLimit] = useState(false);
  
  // All-time stats (separate from limited generations list)
  const [allTimeStats, setAllTimeStats] = useState({ totalSales: 0, totalCosts: 0, completedCount: 0, failedCount: 0 });
  
  // Pricing edit state
  const [editingPricing, setEditingPricing] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState({
    html_price: "0",
    react_price: "0",
    generation_cost_junior: "0.10",
    generation_cost_senior: "0.25",
    external_price: "7",
    manual_price: "0"
  });

  // External upload state
  interface GeneratedFile {
    path: string;
    content: string;
  }
  
  interface ExternalUploadForm {
    siteName: string;
    prompt: string;
    language: string;
    websiteType: string;
    aiModel: string;
    salePrice: number;
    generationCost: number;
  }
  
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState<ExternalUploadForm>({
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!adminLoading && !isAdmin) {
      navigate("/");
    }
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (teamId && isAdmin) {
      fetchAllData();
    }
  }, [teamId, isAdmin]);

  // Auto-fill prices when pricing is loaded or website type/ai model changes
  useEffect(() => {
    if (pricing) {
      const salePrice = uploadForm.websiteType === "react" ? pricing.react_price : pricing.html_price;
      const generationCost = uploadForm.aiModel === "senior" ? pricing.generation_cost_senior : pricing.generation_cost_junior;
      setUploadForm(prev => ({ ...prev, salePrice, generationCost }));
    }
  }, [pricing, uploadForm.websiteType, uploadForm.aiModel]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchTeam(),
      fetchMembers(),
      fetchAdmins(),
      fetchGenerations(),
      fetchAllTimeStats(),
      fetchTransactions(),
      fetchPricing(),
      fetchAppeals()
    ]);
    setLoading(false);
  };

  // Окремий запит для статистики за весь час (без limit)
  const fetchAllTimeStats = async () => {
    const { data } = await supabase
      .from("generation_history")
      .select("status, sale_price, generation_cost")
      .eq("team_id", teamId);

    if (data) {
      const completed = data.filter(g => g.status === "completed");
      const failed = data.filter(g => g.status === "failed");
      setAllTimeStats({
        completedCount: completed.length,
        failedCount: failed.length,
        totalSales: completed.reduce((sum, g) => sum + (g.sale_price || 0), 0),
        totalCosts: completed.reduce((sum, g) => sum + (g.generation_cost || 0), 0)
      });
    }
  };

  const fetchTeam = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (!error && data) {
      // Fetch assigned admins from junction table
      const { data: teamAdminRows } = await supabase
        .from("team_admins")
        .select("admin_id")
        .eq("team_id", data.id);
      
      setTeam({
        ...data,
        assigned_admin_ids: teamAdminRows?.map(r => r.admin_id) || []
      });
      setCreditLimitInput(data.credit_limit?.toString() || "0");
      setReferralLimitInput(data.max_referral_invites?.toString() || "4");
    }
  };

  const fetchMembers = async () => {
    const { data: membersData } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .order("role", { ascending: true });

    if (membersData) {
      const userIds = membersData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setMembers(membersData.map(m => ({
        ...m,
        display_name: profileMap.get(m.user_id) || "Невідомий"
      })));
    }
  };

  const fetchAdmins = async () => {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles && adminRoles.length > 0) {
      const adminUserIds = adminRoles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", adminUserIds);

      setAdmins(profiles?.map(p => ({ user_id: p.user_id, display_name: p.display_name })) || []);
    }
  };

  const fetchGenerations = async () => {
    // Отримуємо генерації по team_id (правильний фільтр)
    const { data: genData } = await supabase
      .from("generation_history")
      // НЕ тягнемо важкі поля типу zip_data/files_data (інакше сторінка може вантажитись вічність)
      .select(
        "id, site_name, sale_price, generation_cost, created_at, status, website_type, ai_model, user_id"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (genData && genData.length > 0) {
      // Отримуємо імена користувачів
      const userIds = [...new Set(genData.map(g => g.user_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setGenerations(genData.map(g => ({
        ...g,
        user_name: profileMap.get(g.user_id || "") || "Невідомий"
      })));
    } else {
      setGenerations([]);
    }
  };

  const fetchTransactions = async () => {
    const { data: txData } = await supabase
      .from("balance_transactions")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (txData) {
      const adminIds = [...new Set(txData.map(t => t.admin_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", adminIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setTransactions(txData.map(t => ({
        ...t,
        admin_name: profileMap.get(t.admin_id) || "Невідомий"
      })));
    }
  };

  const fetchPricing = async () => {
    const { data } = await supabase
      .from("team_pricing")
      .select("*")
      .eq("team_id", teamId)
      .maybeSingle();

    setPricing(data);
    if (data) {
      setPricingForm({
        html_price: data.html_price.toString(),
        react_price: data.react_price.toString(),
        generation_cost_junior: data.generation_cost_junior.toString(),
        generation_cost_senior: data.generation_cost_senior.toString(),
        external_price: data.external_price?.toString() || "7",
        manual_price: data.manual_price?.toString() || "0"
      });
    }
  };

  const fetchAppeals = async () => {
    const { data: appealsData } = await supabase
      .from("appeals")
      // Мінімальний набір полів (уникаємо зайвих JSON-колонок)
      .select(
        "id, reason, status, amount_to_refund, created_at, resolved_at, admin_comment, user_id, generation_id, team_id"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (appealsData && appealsData.length > 0) {
      const userIds = [...new Set(appealsData.map(a => a.user_id))];
      const genIds = appealsData.map(a => a.generation_id);
      
      const [profilesRes, gensRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
        supabase.from("generation_history").select("id, site_name").in("id", genIds)
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p.display_name]) || []);
      const genMap = new Map(gensRes.data?.map(g => [g.id, g.site_name]) || []);

      setAppeals(appealsData.map(a => ({
        ...a,
        user_name: profileMap.get(a.user_id) || "Невідомий",
        site_name: genMap.get(a.generation_id) || "Без назви"
      })));
    } else {
      setAppeals([]);
    }
  };

  const handleSavePricing = async () => {
    setSavingPricing(true);
    
    const pricingData = {
      team_id: teamId,
      html_price: parseFloat(pricingForm.html_price) || 0,
      react_price: parseFloat(pricingForm.react_price) || 0,
      generation_cost_junior: parseFloat(pricingForm.generation_cost_junior) || 0.10,
      generation_cost_senior: parseFloat(pricingForm.generation_cost_senior) || 0.25,
      external_price: parseFloat(pricingForm.external_price) || 7,
      manual_price: parseFloat(pricingForm.manual_price) || 0
    };

    let error;
    if (pricing?.id) {
      const res = await supabase
        .from("team_pricing")
        .update(pricingData)
        .eq("id", pricing.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("team_pricing")
        .insert(pricingData);
      error = res.error;
    }

    if (error) {
      toast({ title: "Помилка", description: "Не вдалося зберегти тарифи", variant: "destructive" });
    } else {
      toast({ title: "Збережено", description: "Тарифи оновлено" });
      setEditingPricing(false);
      fetchPricing();
    }
    setSavingPricing(false);
  };

  const handleAssignAdmin = async (adminId: string, add: boolean) => {
    if (add) {
      const { error } = await supabase
        .from("team_admins")
        .insert({ team_id: teamId, admin_id: adminId });
      if (error) {
        toast({ title: "Помилка", description: "Не вдалося призначити адміністратора", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("team_admins")
        .delete()
        .eq("team_id", teamId)
        .eq("admin_id", adminId);
      if (error) {
        toast({ title: "Помилка", description: "Не вдалося зняти адміністратора", variant: "destructive" });
        return;
      }
    }
    toast({ title: "Збережено", description: "Адміністраторів оновлено" });
    fetchTeam();
  };

  const handleUpdateCreditLimit = async () => {
    const newLimit = parseFloat(creditLimitInput) || 0;
    setSavingCreditLimit(true);
    
    const { error } = await supabase
      .from("teams")
      .update({ credit_limit: newLimit })
      .eq("id", teamId);

    if (error) {
      toast({ title: "Помилка", description: "Не вдалося оновити ліміт", variant: "destructive" });
    } else {
      toast({ title: "Збережено", description: `Ліміт кредиту: $${newLimit}` });
      fetchTeam();
    }
    setSavingCreditLimit(false);
  };

  const handleUpdateReferralLimit = async () => {
    const newLimit = parseInt(referralLimitInput) || 4;
    setSavingReferralLimit(true);
    
    const { error } = await supabase
      .from("teams")
      .update({ max_referral_invites: newLimit })
      .eq("id", teamId);

    if (error) {
      toast({ title: "Помилка", description: "Не вдалося оновити ліміт", variant: "destructive" });
    } else {
      toast({ title: "Збережено", description: `Ліміт інвайтів: ${newLimit}` });
      fetchTeam();
    }
    setSavingReferralLimit(false);
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Скопійовано" });
  };

  const handleExternalUpload = async () => {
    if (!uploadFile || !uploadForm.prompt || !uploadForm.siteName || !team || !teamId) {
      toast({ title: "Помилка", description: "Заповніть всі обов'язкові поля та виберіть ZIP файл", variant: "destructive" });
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

      // Get team owner
      const { data: ownerData } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
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
          team_id: teamId,
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
          .update({ balance: team.balance - uploadForm.salePrice })
          .eq("id", teamId);

        if (balanceError) throw balanceError;

        // Create balance transaction record
        await supabase
          .from("balance_transactions")
          .insert({
            team_id: teamId,
            amount: -uploadForm.salePrice,
            balance_before: team.balance,
            balance_after: team.balance - uploadForm.salePrice,
            note: `Зовнішня генерація: ${uploadForm.siteName}`,
            admin_id: user?.id || ""
          });
      }

      toast({ title: "Успішно", description: "Сайт завантажено в історію" });
      setUploadDialogOpen(false);
      setUploadForm({
        siteName: "",
        prompt: "",
        language: "uk",
        websiteType: "html",
        aiModel: "senior",
        salePrice: 0,
        generationCost: 0
      });
      setUploadFile(null);
      fetchAllData();
    } catch (error) {
      console.error("Error uploading external generation:", error);
      toast({ title: "Помилка", description: "Не вдалося завантажити", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Stats - використовуємо allTimeStats для загальних показників за весь час
  const { totalSales, totalCosts, completedCount, failedCount } = allTimeStats;

  // Members by role
  const membersByRole = members.reduce((acc, m) => {
    if (!acc[m.role]) acc[m.role] = [];
    acc[m.role].push(m);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  // Chart data - generations by day
  const generationsChartData = useMemo(() => {
    const last30Days: Record<string, { date: string; completed: number; failed: number; sales: number; costs: number }> = {};
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last30Days[dateStr] = { date: dateStr, completed: 0, failed: 0, sales: 0, costs: 0 };
    }

    generations.forEach(g => {
      const dateStr = new Date(g.created_at).toISOString().split('T')[0];
      if (last30Days[dateStr]) {
        if (g.status === "completed") {
          last30Days[dateStr].completed += 1;
          last30Days[dateStr].sales += g.sale_price || 0;
          last30Days[dateStr].costs += g.generation_cost || 0;
        } else if (g.status === "failed") {
          last30Days[dateStr].failed += 1;
        }
      }
    });

    return Object.values(last30Days).map(d => ({
      ...d,
      dateLabel: new Date(d.date).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })
    }));
  }, [generations]);

  // Chart data - balance history
  const balanceChartData = useMemo(() => {
    if (transactions.length === 0) return [];
    
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return sorted.slice(-30).map(tx => ({
      date: new Date(tx.created_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }),
      balance: tx.balance_after,
      change: tx.amount
    }));
  }, [transactions]);

  // Chart data - generation types pie
  const typesPieData = useMemo(() => {
    const types: Record<string, number> = {};
    generations.filter(g => g.status === "completed").forEach(g => {
      const type = g.website_type || "unknown";
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [generations]);

  // Chart data - AI models pie
  const modelsPieData = useMemo(() => {
    const models: Record<string, number> = {};
    generations.filter(g => g.status === "completed").forEach(g => {
      const model = g.ai_model || "unknown";
      models[model] = (models[model] || 0) + 1;
    });
    return Object.entries(models).map(([name, value]) => ({ name: name === "junior" ? "Junior" : "Senior", value }));
  }, [generations]);

  const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];


  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!team) {
    return (
      <AppLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate("/admin?tab=teams")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
          <p className="text-center text-muted-foreground mt-8">Команду не знайдено</p>
        </div>
      </AppLayout>
    );
  }

  const assignedAdmins = admins.filter(a => team.assigned_admin_ids.includes(a.user_id));

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin?tab=teams")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6" />
                {team.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Створено: {new Date(team.created_at).toLocaleDateString("uk-UA")}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Оновити
          </Button>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Wallet className="h-4 w-4" />
                Баланс
              </div>
              <div className={`text-2xl font-bold ${team.balance < 0 ? "text-red-500" : "text-green-500"}`}>
                ${team.balance?.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Продажі
              </div>
              <div className="text-2xl font-bold text-green-500">${totalSales.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <FileText className="h-4 w-4" />
                Сайтів
              </div>
              <div className="text-2xl font-bold">{completedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" />
                Учасників
              </div>
              <div className="text-2xl font-bold">{members.filter(m => m.status === "approved").length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Generations Over Time */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Генерації за останні 30 днів
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={generationsChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="dateLabel" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px"
                      }}
                    />
                    <Bar dataKey="completed" name="Успішні" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="failed" name="Невдалі" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sales Over Time */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Продажі
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={generationsChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="dateLabel" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px"
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      name="Продажі" 
                      stroke="hsl(var(--chart-2))" 
                      fill="hsl(var(--chart-2))" 
                      fillOpacity={0.3} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Balance History */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Історія балансу
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-[200px]">
                {balanceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={balanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px"
                        }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="balance" 
                        name="Баланс" 
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.3} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Немає даних про транзакції
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Buyer Analytics */}
          <BuyerGenerationsAnalytics members={members} teamId={teamId!} />

          {/* Pie Charts */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Розподіл генерацій
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-[200px] flex">
                {/* Types Pie */}
                <div className="flex-1">
                  <div className="text-xs text-center text-muted-foreground mb-1">За типом</div>
                  {typesPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                      <PieChart>
                        <Pie
                          data={typesPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {typesPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--popover))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px"
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                      Немає даних
                    </div>
                  )}
                </div>
                {/* Models Pie */}
                <div className="flex-1">
                  <div className="text-xs text-center text-muted-foreground mb-1">За AI моделлю</div>
                  {modelsPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                      <PieChart>
                        <Pie
                          data={modelsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {modelsPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--popover))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px"
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                      Немає даних
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Налаштування команди
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Призначені адміністратори</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {assignedAdmins.map(admin => (
                    <Badge key={admin.user_id} variant="secondary" className="gap-1">
                      {admin.display_name || admin.user_id.slice(0, 8)}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => handleAssignAdmin(admin.user_id, false)}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select
                  value=""
                  onValueChange={(value) => handleAssignAdmin(value, true)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="+ Додати адміністратора" />
                  </SelectTrigger>
                  <SelectContent>
                    {admins
                      .filter(a => !team.assigned_admin_ids.includes(a.user_id))
                      .map((admin) => (
                        <SelectItem key={admin.user_id} value={admin.user_id}>
                          {admin.display_name || admin.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ліміт кредиту ($)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={creditLimitInput}
                    onChange={(e) => setCreditLimitInput(e.target.value)}
                    className="h-9"
                    min={0}
                    step={10}
                  />
                  <Button 
                    size="sm" 
                    className="h-9"
                    onClick={handleUpdateCreditLimit}
                    disabled={savingCreditLimit}
                  >
                    {savingCreditLimit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Зберегти"}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Поточний ліміт</label>
                <div className="h-9 flex items-center">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    ${team.credit_limit?.toFixed(2) || "0.00"}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ліміт реферальних інвайтів</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={referralLimitInput}
                    onChange={(e) => setReferralLimitInput(e.target.value)}
                    className="h-9 w-20"
                    min={0}
                    step={1}
                  />
                  <Button 
                    size="sm" 
                    className="h-9"
                    onClick={handleUpdateReferralLimit}
                    disabled={savingReferralLimit}
                  >
                    {savingReferralLimit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Зберегти"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="members" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="members" className="text-xs">
              <Users className="h-4 w-4 mr-1" />
              Команда
            </TabsTrigger>
            <TabsTrigger value="finance" className="text-xs">
              <Wallet className="h-4 w-4 mr-1" />
              Фінанси
            </TabsTrigger>
            <TabsTrigger value="generations" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" />
              Генерації
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs">
              <TrendingUp className="h-4 w-4 mr-1" />
              Баланс
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs">
              <FileText className="h-4 w-4 mr-1" />
              Тарифи
            </TabsTrigger>
            <TabsTrigger value="appeals" className="text-xs">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Апеляції
              {appeals.filter(a => a.status === "pending").length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1">
                  {appeals.filter(a => a.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            {["owner", "team_lead", "buyer", "tech_dev"].map((role) => {
              const roleMembers = membersByRole[role] || [];
              if (roleMembers.length === 0) return null;
              const RoleIcon = roleIcons[role] || Users;
              
              return (
                <Card key={role}>
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <RoleIcon className="h-4 w-4" />
                      {roleLabels[role] || role}
                      <Badge variant="secondary" className="text-xs">{roleMembers.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="space-y-2">
                      {roleMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{member.display_name}</span>
                            <Badge 
                              variant={member.status === "approved" ? "default" : member.status === "pending" ? "secondary" : "destructive"}
                              className="text-[10px]"
                            >
                              {member.status === "approved" ? "Активний" : member.status === "pending" ? "Очікує" : "Відхилено"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(member.created_at).toLocaleDateString("uk-UA")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {members.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Немає учасників</p>
            )}
          </TabsContent>

          {/* Generations Tab */}
          <TabsContent value="generations">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Історія генерацій
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setUploadDialogOpen(true)}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Завантажити зовнішній
                    </Button>
                    <Badge variant="default">{completedCount} успішних</Badge>
                    <Badge variant="destructive">{failedCount} невдалих</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {generations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Немає генерацій</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Сайт</TableHead>
                        <TableHead className="text-xs">Користувач</TableHead>
                        <TableHead className="text-xs">Тип</TableHead>
                        <TableHead className="text-xs">Модель</TableHead>
                        <TableHead className="text-xs">Ціна</TableHead>
                        <TableHead className="text-xs">Витрати</TableHead>
                        <TableHead className="text-xs">Статус</TableHead>
                        <TableHead className="text-xs">Дата</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generations.slice(0, 50).map((gen) => (
                        <TableRow key={gen.id}>
                          <TableCell className="text-xs font-medium max-w-[150px] truncate">
                            {gen.site_name || "Без назви"}
                          </TableCell>
                          <TableCell className="text-xs">{gen.user_name}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">{gen.website_type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{gen.ai_model}</TableCell>
                          <TableCell className="text-xs text-green-600 font-medium">
                            ${gen.sale_price?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell className="text-xs text-orange-600">
                            ${gen.generation_cost?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={gen.status === "completed" ? "default" : gen.status === "failed" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {gen.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(gen.created_at).toLocaleDateString("uk-UA")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance Tab - Full financial management */}
          <TabsContent value="finance">
            <TeamFinanceManager
              teamId={teamId!}
              teamName={team.name}
              currentBalance={team.balance}
              creditLimit={team.credit_limit || 0}
              members={members.map(m => ({
                id: m.id,
                user_id: m.user_id,
                display_name: m.display_name
              }))}
              onBalanceChange={fetchTeam}
            />
          </TabsContent>

          {/* Transactions Tab - Balance transaction history only */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Історія зміни балансу
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Немає транзакцій</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Дата</TableHead>
                        <TableHead className="text-xs">Сума</TableHead>
                        <TableHead className="text-xs">До</TableHead>
                        <TableHead className="text-xs">Після</TableHead>
                        <TableHead className="text-xs">Примітка</TableHead>
                        <TableHead className="text-xs">Адмін</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs">
                            {new Date(tx.created_at).toLocaleString("uk-UA")}
                          </TableCell>
                          <TableCell className={`text-xs font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs">${tx.balance_before.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">${tx.balance_after.toFixed(2)}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{tx.note}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.admin_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Тарифи команди
                  </span>
                  {!editingPricing ? (
                    <Button size="sm" variant="outline" onClick={() => setEditingPricing(true)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Редагувати
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingPricing(false)}>
                        Скасувати
                      </Button>
                      <Button size="sm" onClick={handleSavePricing} disabled={savingPricing}>
                        {savingPricing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        Зберегти
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {editingPricing ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">HTML ціна ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pricingForm.html_price}
                        onChange={(e) => setPricingForm(p => ({ ...p, html_price: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">React ціна ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pricingForm.react_price}
                        onChange={(e) => setPricingForm(p => ({ ...p, react_price: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Зовнішня ціна ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pricingForm.external_price}
                        onChange={(e) => setPricingForm(p => ({ ...p, external_price: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Витрати Junior AI ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pricingForm.generation_cost_junior}
                        onChange={(e) => setPricingForm(p => ({ ...p, generation_cost_junior: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Витрати Senior AI ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pricingForm.generation_cost_senior}
                        onChange={(e) => setPricingForm(p => ({ ...p, generation_cost_senior: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Ручна генерація ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pricingForm.manual_price}
                        onChange={(e) => setPricingForm(p => ({ ...p, manual_price: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  </div>
                ) : pricing ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">HTML ціна</div>
                      <div className="text-lg font-bold">${pricing.html_price.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">React ціна</div>
                      <div className="text-lg font-bold">${pricing.react_price.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Зовнішня ціна</div>
                      <div className="text-lg font-bold">${pricing.external_price?.toFixed(2) || "—"}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Витрати Junior AI</div>
                      <div className="text-lg font-bold">${pricing.generation_cost_junior.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Витрати Senior AI</div>
                      <div className="text-lg font-bold">${pricing.generation_cost_senior.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Ручна генерація</div>
                      <div className="text-lg font-bold">${pricing.manual_price?.toFixed(2) || "0.00"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm mb-3">Тарифи не налаштовані (використовуються стандартні)</p>
                    <Button size="sm" onClick={() => setEditingPricing(true)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Створити тарифи
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appeals Tab */}
          <TabsContent value="appeals">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Апеляції команди
                  </span>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="secondary">{appeals.filter(a => a.status === "pending").length} очікує</Badge>
                    <Badge variant="default">{appeals.filter(a => a.status === "approved").length} схвалено</Badge>
                    <Badge variant="destructive">{appeals.filter(a => a.status === "rejected").length} відхилено</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {appeals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Немає апеляцій</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Дата</TableHead>
                        <TableHead className="text-xs">Користувач</TableHead>
                        <TableHead className="text-xs">Сайт</TableHead>
                        <TableHead className="text-xs">Причина</TableHead>
                        <TableHead className="text-xs">Сума</TableHead>
                        <TableHead className="text-xs">Статус</TableHead>
                        <TableHead className="text-xs">Коментар</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appeals.map((appeal) => (
                        <TableRow key={appeal.id}>
                          <TableCell className="text-xs">
                            {new Date(appeal.created_at).toLocaleDateString("uk-UA")}
                          </TableCell>
                          <TableCell className="text-xs">{appeal.user_name}</TableCell>
                          <TableCell className="text-xs max-w-[120px] truncate">{appeal.site_name}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{appeal.reason}</TableCell>
                          <TableCell className="text-xs font-medium text-orange-600">
                            ${appeal.amount_to_refund.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={appeal.status === "approved" ? "default" : appeal.status === "rejected" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {appeal.status === "pending" ? "Очікує" : appeal.status === "approved" ? "Схвалено" : "Відхилено"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">
                            {appeal.admin_comment || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* External Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Завантажити зовнішню генерацію
              </DialogTitle>
              <DialogDescription>
                Завантажте ZIP файл сайту для команди "{team.name}". 
                Він буде доданий в історію як звичайна генерація.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Назва сайту *</Label>
                <Input
                  value={uploadForm.siteName}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, siteName: e.target.value }))}
                  placeholder="Назва сайту"
                />
              </div>

              <div className="space-y-2">
                <Label>Промпт *</Label>
                <Textarea
                  value={uploadForm.prompt}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="Опис сайту / промпт генерації"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Мова</Label>
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
                  <Label>Тип сайту</Label>
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
                  <Label>AI модель</Label>
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
                  <Label>Ціна продажу (списання з балансу)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={uploadForm.salePrice}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                  {pricing ? (
                    <p className="text-xs text-muted-foreground">
                      Стандартна ціна для {uploadForm.websiteType.toUpperCase()}: <span className="font-medium">${(uploadForm.websiteType === "react" ? pricing.react_price : pricing.html_price).toFixed(2)}</span> (з тарифів команди)
                    </p>
                  ) : (
                    <p className="text-xs text-amber-500">Тарифи команди не налаштовані</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Собівартість генерації</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={uploadForm.generationCost}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, generationCost: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
                {pricing && (
                  <p className="text-xs text-muted-foreground">
                    Стандартна собівартість для {uploadForm.aiModel === "senior" ? "Senior" : "Junior"}: <span className="font-medium">${(uploadForm.aiModel === "senior" ? pricing.generation_cost_senior : pricing.generation_cost_junior).toFixed(2)}</span> (з тарифів команди)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Для статистики. Не списується з балансу.
                </p>
              </div>

              <div className="space-y-2">
                <Label>ZIP файл *</Label>
                <Input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile && (
                  <p className="text-xs text-muted-foreground">
                    Вибрано: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {team && uploadForm.salePrice > 0 && (
                <div className="p-3 rounded border bg-muted/30">
                  <p className="text-sm">
                    Поточний баланс: <span className="font-medium">${team.balance.toFixed(2)}</span>
                  </p>
                  <p className="text-sm">
                    Після списання: <span className={`font-medium ${team.balance - uploadForm.salePrice < 0 ? "text-red-500" : "text-green-500"}`}>
                      ${(team.balance - uploadForm.salePrice).toFixed(2)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(false)}
                disabled={uploading}
              >
                Скасувати
              </Button>
              <Button
                onClick={handleExternalUpload}
                disabled={uploading || !uploadFile || !uploadForm.prompt || !uploadForm.siteName}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Завантаження...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Завантажити
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminTeamDetails;
