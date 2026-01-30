import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import { uk as ukLocale } from "date-fns/locale";
import { 
  Wallet, 
  Plus, 
  Minus, 
  Loader2, 
  Filter, 
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  ChevronDown,
  Download,
  RotateCcw
} from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  display_name: string | null;
}

interface FinanceTransaction {
  id: string;
  originalId?: string;
  type: "generation" | "refund" | "appeal" | "manual_add" | "manual_subtract";
  amount: number;
  description: string;
  date: string;
  user_id?: string;
  user_name?: string;
  balance_after?: number;
  site_name?: string;
  canReverse?: boolean;
}

interface DatePreset {
  label: string;
  days: number;
}

const DATE_PRESETS: DatePreset[] = [
  { label: "Сьогодні", days: 0 },
  { label: "Вчора", days: 1 },
  { label: "Тиждень", days: 7 },
  { label: "Місяць", days: 30 },
  { label: "Все", days: -1 }
];

interface Props {
  teamId: string;
  teamName: string;
  currentBalance: number;
  members: TeamMember[];
  onBalanceChange: () => void;
}

export function TeamFinanceManager({ teamId, teamName, currentBalance, members, onBalanceChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Reverse transaction state
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [transactionToReverse, setTransactionToReverse] = useState<FinanceTransaction | null>(null);
  const [reversing, setReversing] = useState(false);

  // Data state
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterBuyer, setFilterBuyer] = useState<string>("all");
  const [filterDatePreset, setFilterDatePreset] = useState<number>(-1);
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  useEffect(() => {
    fetchAllTransactions();
  }, [teamId]);

  const fetchAllTransactions = async () => {
    setLoading(true);
    
    try {
      // Fetch generation history (sales)
      const { data: generations } = await supabase
        .from("generation_history")
        .select("id, site_name, sale_price, created_at, status, user_id")
        .eq("team_id", teamId)
        .not("sale_price", "is", null)
        .order("created_at", { ascending: false });

      // Fetch appeals (refunds)
      const { data: appeals } = await supabase
        .from("appeals")
        .select("id, amount_to_refund, status, created_at, resolved_at, user_id, generation_id")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

      // Fetch balance transactions (manual adjustments)
      const { data: balanceTx } = await supabase
        .from("balance_transactions")
        .select("id, amount, balance_after, note, created_at, admin_id")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

      // Get user profiles for display names
      const userIds = new Set<string>();
      generations?.forEach(g => g.user_id && userIds.add(g.user_id));
      appeals?.forEach(a => a.user_id && userIds.add(a.user_id));
      balanceTx?.forEach(t => t.admin_id && userIds.add(t.admin_id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      // Get site names for appeals
      const genIds = appeals?.map(a => a.generation_id) || [];
      const { data: genData } = await supabase
        .from("generation_history")
        .select("id, site_name")
        .in("id", genIds);
      const genMap = new Map(genData?.map(g => [g.id, g.site_name]) || []);

      // Build unified transaction list
      const txList: FinanceTransaction[] = [];

      // Add generations
      generations?.forEach(gen => {
        if (gen.sale_price && gen.sale_price > 0 && gen.status === "completed") {
          txList.push({
            id: `gen-${gen.id}`,
            type: "generation",
            amount: -gen.sale_price,
            description: gen.site_name || "Генерація сайту",
            date: gen.created_at,
            user_id: gen.user_id || undefined,
            user_name: profileMap.get(gen.user_id || "") || "Невідомий",
            site_name: gen.site_name || undefined,
            canReverse: false
          });
        }
      });

      // Add appeals
      appeals?.forEach(appeal => {
        if (appeal.status === "approved" && appeal.amount_to_refund > 0) {
          txList.push({
            id: `appeal-${appeal.id}`,
            type: "appeal",
            amount: appeal.amount_to_refund,
            description: `Повернення за апеляцією: ${genMap.get(appeal.generation_id) || "Невідомий сайт"}`,
            date: appeal.resolved_at || appeal.created_at,
            user_id: appeal.user_id,
            user_name: profileMap.get(appeal.user_id) || "Невідомий",
            site_name: genMap.get(appeal.generation_id) || undefined,
            canReverse: false
          });
        }
      });

      // Add balance transactions
      balanceTx?.forEach(tx => {
        const isReversal = tx.note.startsWith("[СТОРНО]");
        txList.push({
          id: `tx-${tx.id}`,
          originalId: tx.id,
          type: tx.amount >= 0 ? "manual_add" : "manual_subtract",
          amount: tx.amount,
          description: tx.note,
          date: tx.created_at,
          user_name: profileMap.get(tx.admin_id) || "Адмін",
          balance_after: tx.balance_after,
          canReverse: !isReversal
        });
      });

      // Sort by date descending
      txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(txList);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({ title: "Помилка", description: "Не вдалося завантажити транзакції", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Помилка", description: "Введіть коректну суму", variant: "destructive" });
      return;
    }

    if (!adjustNote.trim()) {
      toast({ title: "Помилка", description: "Введіть примітку", variant: "destructive" });
      return;
    }

    setAdjusting(true);

    try {
      const changeAmount = adjustType === "add" ? amount : -amount;
      const newBalance = currentBalance + changeAmount;

      // Update team balance
      const { error: updateError } = await supabase
        .from("teams")
        .update({ balance: newBalance })
        .eq("id", teamId);

      if (updateError) throw updateError;

      // Create balance transaction record
      const { error: txError } = await supabase
        .from("balance_transactions")
        .insert({
          team_id: teamId,
          amount: changeAmount,
          balance_before: currentBalance,
          balance_after: newBalance,
          note: adjustNote.trim(),
          admin_id: user?.id || ""
        });

      if (txError) throw txError;

      toast({ 
        title: "Успішно", 
        description: `Баланс ${adjustType === "add" ? "поповнено" : "зменшено"} на $${amount.toFixed(2)}` 
      });

      setAdjustDialogOpen(false);
      setAdjustAmount("");
      setAdjustNote("");
      onBalanceChange();
      fetchAllTransactions();
    } catch (error) {
      console.error("Error adjusting balance:", error);
      toast({ title: "Помилка", description: "Не вдалося змінити баланс", variant: "destructive" });
    } finally {
      setAdjusting(false);
    }
  };

  const handleReverseTransaction = async () => {
    if (!transactionToReverse || !transactionToReverse.originalId) return;

    setReversing(true);

    try {
      // Reverse the amount (opposite sign)
      const reverseAmount = -transactionToReverse.amount;
      const newBalance = currentBalance + reverseAmount;

      // Update team balance
      const { error: updateError } = await supabase
        .from("teams")
        .update({ balance: newBalance })
        .eq("id", teamId);

      if (updateError) throw updateError;

      // Create reversal transaction record
      const { error: txError } = await supabase
        .from("balance_transactions")
        .insert({
          team_id: teamId,
          amount: reverseAmount,
          balance_before: currentBalance,
          balance_after: newBalance,
          note: `[СТОРНО] ${transactionToReverse.description}`,
          admin_id: user?.id || ""
        });

      if (txError) throw txError;

      toast({ 
        title: "Сторновано", 
        description: `Транзакцію на ${transactionToReverse.amount >= 0 ? "+" : ""}$${transactionToReverse.amount.toFixed(2)} сторновано` 
      });

      setReverseDialogOpen(false);
      setTransactionToReverse(null);
      onBalanceChange();
      fetchAllTransactions();
    } catch (error) {
      console.error("Error reversing transaction:", error);
      toast({ title: "Помилка", description: "Не вдалося сторнувати транзакцію", variant: "destructive" });
    } finally {
      setReversing(false);
    }
  };

  const openReverseDialog = (tx: FinanceTransaction) => {
    setTransactionToReverse(tx);
    setReverseDialogOpen(true);
  };

  const openAdjustDialog = (type: "add" | "subtract") => {
    setAdjustType(type);
    setAdjustAmount("");
    setAdjustNote("");
    setAdjustDialogOpen(true);
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Filter by type
      if (filterType !== "all") {
        if (filterType === "generation" && tx.type !== "generation") return false;
        if (filterType === "appeal" && tx.type !== "appeal") return false;
        if (filterType === "manual" && !tx.type.startsWith("manual")) return false;
      }

      // Filter by buyer
      if (filterBuyer !== "all" && tx.user_id !== filterBuyer) return false;

      // Filter by date
      const txDate = parseISO(tx.date);
      
      if (filterDatePreset >= 0) {
        const startDate = filterDatePreset === 0 
          ? startOfDay(new Date()) 
          : startOfDay(subDays(new Date(), filterDatePreset));
        const endDate = endOfDay(new Date());
        
        if (!isWithinInterval(txDate, { start: startDate, end: endDate })) return false;
      }

      if (filterDateFrom) {
        const from = startOfDay(parseISO(filterDateFrom));
        if (txDate < from) return false;
      }

      if (filterDateTo) {
        const to = endOfDay(parseISO(filterDateTo));
        if (txDate > to) return false;
      }

      return true;
    });
  }, [transactions, filterType, filterBuyer, filterDatePreset, filterDateFrom, filterDateTo]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        if (tx.amount > 0) acc.income += tx.amount;
        else acc.expense += Math.abs(tx.amount);
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [filteredTransactions]);

  const clearFilters = () => {
    setFilterType("all");
    setFilterBuyer("all");
    setFilterDatePreset(-1);
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters = filterType !== "all" || filterBuyer !== "all" || filterDatePreset !== -1 || filterDateFrom || filterDateTo;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "generation": return "Генерація";
      case "appeal": return "Апеляція";
      case "manual_add": return "Поповнення";
      case "manual_subtract": return "Списання";
      default: return type;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "generation": return "secondary";
      case "appeal": return "default";
      case "manual_add": return "default";
      case "manual_subtract": return "destructive";
      default: return "outline";
    }
  };

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      toast({ title: "Немає даних", description: "Немає транзакцій для експорту", variant: "destructive" });
      return;
    }

    const headers = ["Дата", "Тип", "Опис", "Користувач", "Сума"];
    const rows = filteredTransactions.map(tx => [
      format(parseISO(tx.date), "dd.MM.yyyy HH:mm"),
      getTypeLabel(tx.type),
      tx.description.replace(/,/g, ";"),
      tx.user_name || "-",
      tx.amount.toFixed(2)
    ]);

    // Add summary row
    rows.push([]);
    rows.push(["", "", "", "Надходження:", `+${totals.income.toFixed(2)}`]);
    rows.push(["", "", "", "Витрати:", `-${totals.expense.toFixed(2)}`]);
    rows.push(["", "", "", "Баланс:", `${(totals.income - totals.expense).toFixed(2)}`]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${teamName}_finance_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Експортовано", description: "Файл виписки завантажено" });
  };

  return (
    <div className="space-y-4">
      {/* Balance Actions Card */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Керування балансом
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={currentBalance >= 0 ? "default" : "destructive"} className="text-base px-3">
                ${currentBalance.toFixed(2)}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => openAdjustDialog("add")} 
              className="gap-2"
              variant="default"
            >
              <Plus className="h-4 w-4" />
              Поповнити баланс
            </Button>
            <Button 
              onClick={() => openAdjustDialog("subtract")} 
              className="gap-2"
              variant="outline"
            >
              <Minus className="h-4 w-4" />
              Списати з балансу
            </Button>
            <Button 
              onClick={exportToCSV} 
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Експорт виписки
            </Button>
            <Button 
              onClick={fetchAllTransactions} 
              variant="ghost"
              size="icon"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Фільтри
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="text-[10px]">Активні</Badge>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* Type filter */}
                <div>
                  <Label className="text-xs mb-1 block">Тип</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі типи</SelectItem>
                      <SelectItem value="generation">Генерації</SelectItem>
                      <SelectItem value="appeal">Апеляції</SelectItem>
                      <SelectItem value="manual">Ручні</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Buyer filter */}
                <div>
                  <Label className="text-xs mb-1 block">Баєр</Label>
                  <Select value={filterBuyer} onValueChange={setFilterBuyer}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі баєри</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.display_name || m.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date presets */}
                <div>
                  <Label className="text-xs mb-1 block">Період</Label>
                  <Select 
                    value={filterDatePreset.toString()} 
                    onValueChange={(v) => {
                      setFilterDatePreset(parseInt(v));
                      setFilterDateFrom("");
                      setFilterDateTo("");
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_PRESETS.map(preset => (
                        <SelectItem key={preset.days} value={preset.days.toString()}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom date range */}
                <div>
                  <Label className="text-xs mb-1 block">Від</Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => {
                      setFilterDateFrom(e.target.value);
                      setFilterDatePreset(-1);
                    }}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">До</Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => {
                      setFilterDateTo(e.target.value);
                      setFilterDatePreset(-1);
                    }}
                    className="h-9"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="mt-3"
                >
                  <X className="h-3 w-3 mr-1" />
                  Скинути фільтри
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ArrowUpCircle className="h-3 w-3 text-green-500" />
              Надходження
            </div>
            <div className="text-lg font-bold text-green-500">
              +${totals.income.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ArrowDownCircle className="h-3 w-3 text-red-500" />
              Витрати
            </div>
            <div className="text-lg font-bold text-red-500">
              -${totals.expense.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              Транзакцій
            </div>
            <div className="text-lg font-bold">
              {filteredTransactions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Історія фінансових операцій
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {hasActiveFilters ? "Немає транзакцій за обраними фільтрами" : "Немає транзакцій"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Дата</TableHead>
                    <TableHead className="text-xs">Тип</TableHead>
                    <TableHead className="text-xs">Опис</TableHead>
                    <TableHead className="text-xs">Користувач</TableHead>
                    <TableHead className="text-xs text-right">Сума</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.slice(0, 200).map((tx) => (
                    <TableRow key={tx.id} className={tx.description.startsWith("[СТОРНО]") ? "opacity-60" : ""}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(parseISO(tx.date), "dd.MM.yyyy HH:mm", { locale: ukLocale })}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getTypeBadgeVariant(tx.type) as any} 
                          className="text-[10px]"
                        >
                          {getTypeLabel(tx.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[250px] truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tx.user_name || "-"}
                      </TableCell>
                      <TableCell className={`text-xs font-medium text-right ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.canReverse && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openReverseDialog(tx)}
                            title="Сторнувати транзакцію"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Balance Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustType === "add" ? (
                <>
                  <Plus className="h-5 w-5 text-green-500" />
                  Поповнити баланс
                </>
              ) : (
                <>
                  <Minus className="h-5 w-5 text-red-500" />
                  Списати з балансу
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Команда: {teamName} | Поточний баланс: ${currentBalance.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="amount">Сума ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="note">Примітка *</Label>
              <Textarea
                id="note"
                placeholder={adjustType === "add" 
                  ? "Наприклад: Поповнення балансу, оплата #123" 
                  : "Наприклад: Корекція, повернення коштів"}
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                className="mt-1 min-h-[80px]"
              />
            </div>
            
            {adjustAmount && parseFloat(adjustAmount) > 0 && (
              <div className="p-3 rounded bg-muted">
                <div className="text-sm">
                  <span className="text-muted-foreground">Поточний баланс:</span>{" "}
                  <span className="font-medium">${currentBalance.toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{adjustType === "add" ? "Поповнення" : "Списання"}:</span>{" "}
                  <span className={`font-medium ${adjustType === "add" ? "text-green-600" : "text-red-600"}`}>
                    {adjustType === "add" ? "+" : "-"}${parseFloat(adjustAmount).toFixed(2)}
                  </span>
                </div>
                <div className="text-sm border-t mt-2 pt-2">
                  <span className="text-muted-foreground">Новий баланс:</span>{" "}
                  <span className="font-bold">
                    ${(currentBalance + (adjustType === "add" ? parseFloat(adjustAmount) : -parseFloat(adjustAmount))).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Скасувати
            </Button>
            <Button 
              onClick={handleAdjustBalance} 
              disabled={adjusting || !adjustAmount || !adjustNote.trim()}
              variant={adjustType === "add" ? "default" : "destructive"}
            >
              {adjusting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : adjustType === "add" ? (
                <Plus className="h-4 w-4 mr-2" />
              ) : (
                <Minus className="h-4 w-4 mr-2" />
              )}
              {adjustType === "add" ? "Поповнити" : "Списати"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse Transaction Dialog */}
      <AlertDialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Сторнувати транзакцію?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {transactionToReverse && (
                <div className="mt-2 space-y-2">
                  <p>Ви збираєтесь сторнувати транзакцію:</p>
                  <div className="p-3 rounded bg-muted">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Опис:</span>{" "}
                      <span className="font-medium">{transactionToReverse.description}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Сума:</span>{" "}
                      <span className={`font-medium ${transactionToReverse.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {transactionToReverse.amount >= 0 ? "+" : ""}${transactionToReverse.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm border-t mt-2 pt-2">
                      <span className="text-muted-foreground">Буде створено зворотню транзакцію:</span>{" "}
                      <span className={`font-bold ${-transactionToReverse.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {-transactionToReverse.amount >= 0 ? "+" : ""}${(-transactionToReverse.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReverseTransaction}
              disabled={reversing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reversing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Сторнувати
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
