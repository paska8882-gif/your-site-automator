import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Save, DollarSign, TrendingUp, FileText, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SimplePreview } from "@/components/SimplePreview";

interface GeneratedFile {
  path: string;
  content: string;
}

interface GenerationWithSpend {
  id: string;
  number: number;
  prompt: string;
  improved_prompt: string | null;
  site_name: string | null;
  language: string;
  website_type: string | null;
  ai_model: string | null;
  specific_ai_model: string | null;
  created_at: string;
  completed_at: string | null;
  status: string;
  files_data: GeneratedFile[] | null;
  generation_cost: number | null;
  sale_price: number | null;
  spend_id: string | null;
  spend_amount: number;
  spend_notes: string | null;
}

const Spends = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<GenerationWithSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedSpends, setEditedSpends] = useState<Record<string, { amount: string; notes: string }>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGenerations();
    }
  }, [user]);

  const fetchGenerations = async () => {
    if (!user) return;

    const { data: genData, error: genError } = await supabase
      .from("generation_history")
      .select("id, number, prompt, improved_prompt, site_name, language, website_type, ai_model, specific_ai_model, created_at, completed_at, status, files_data, generation_cost, sale_price")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (genError) {
      toast({ title: "Помилка", description: "Не вдалося завантажити генерації", variant: "destructive" });
      setLoading(false);
      return;
    }

    const genIds = genData?.map(g => g.id) || [];
    
    let spendsMap: Record<string, { id: string; spend_amount: number; notes: string | null }> = {};
    
    if (genIds.length > 0) {
      const { data: spendsData } = await supabase
        .from("generation_spends")
        .select("id, generation_id, spend_amount, notes")
        .in("generation_id", genIds);

      if (spendsData) {
        spendsData.forEach(s => {
          spendsMap[s.generation_id] = { id: s.id, spend_amount: s.spend_amount, notes: s.notes };
        });
      }
    }

    const combined: GenerationWithSpend[] = (genData || []).map(g => ({
      ...g,
      files_data: (Array.isArray(g.files_data) ? g.files_data as unknown as GeneratedFile[] : null),
      spend_id: spendsMap[g.id]?.id || null,
      spend_amount: spendsMap[g.id]?.spend_amount || 0,
      spend_notes: spendsMap[g.id]?.notes || null,
    }));

    setGenerations(combined);
    
    // Initialize edited spends
    const initial: Record<string, { amount: string; notes: string }> = {};
    combined.forEach(g => {
      initial[g.id] = { 
        amount: g.spend_amount?.toString() || "0", 
        notes: g.spend_notes || "" 
      };
    });
    setEditedSpends(initial);
    
    setLoading(false);
  };

  const handleSaveSpend = async (generationId: string) => {
    if (!user) return;
    
    const edited = editedSpends[generationId];
    if (!edited) return;

    const amount = parseFloat(edited.amount) || 0;
    const gen = generations.find(g => g.id === generationId);
    
    setSaving(generationId);

    if (gen?.spend_id) {
      // Update existing
      const { error } = await supabase
        .from("generation_spends")
        .update({ spend_amount: amount, notes: edited.notes || null })
        .eq("id", gen.spend_id);

      if (error) {
        toast({ title: "Помилка", description: "Не вдалося оновити спенд", variant: "destructive" });
      } else {
        toast({ title: "Збережено", description: `Спенд $${amount} збережено` });
        fetchGenerations();
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from("generation_spends")
        .insert({ 
          generation_id: generationId, 
          user_id: user.id, 
          spend_amount: amount, 
          notes: edited.notes || null 
        });

      if (error) {
        toast({ title: "Помилка", description: "Не вдалося зберегти спенд", variant: "destructive" });
      } else {
        toast({ title: "Збережено", description: `Спенд $${amount} збережено` });
        fetchGenerations();
      }
    }

    setSaving(null);
  };

  const handleAmountChange = (genId: string, value: string) => {
    setEditedSpends(prev => ({
      ...prev,
      [genId]: { ...prev[genId], amount: value }
    }));
  };

  const handleNotesChange = (genId: string, value: string) => {
    setEditedSpends(prev => ({
      ...prev,
      [genId]: { ...prev[genId], notes: value }
    }));
  };

  const totalSpend = generations.reduce((sum, g) => sum + (g.spend_amount || 0), 0);
  const avgSpend = generations.length > 0 ? totalSpend / generations.length : 0;
  const sitesWithSpend = generations.filter(g => g.spend_amount > 0).length;

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Спенди</h1>
          <p className="text-muted-foreground">Відстежуйте витрати по кожному згенерованому сайту</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Загальний спенд</p>
                  <p className="text-2xl font-bold">${totalSpend.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Середній спенд</p>
                  <p className="text-2xl font-bold">${avgSpend.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <FileText className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Сайтів з даними</p>
                  <p className="text-2xl font-bold">{sitesWithSpend} / {generations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Генерації</CardTitle>
          </CardHeader>
          <CardContent>
            {generations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                У вас поки немає завершених генерацій
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Назва / Промпт</TableHead>
                      <TableHead className="w-24">Мова</TableHead>
                      <TableHead className="w-24">Тип</TableHead>
                      <TableHead className="w-24">Модель</TableHead>
                      <TableHead className="w-32">Дата</TableHead>
                      <TableHead className="w-32">Спенд ($)</TableHead>
                      <TableHead className="w-48">Нотатки</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generations.map((gen) => {
                      const isExpanded = expandedRows.has(gen.id);
                      return (
                        <>
                          <TableRow key={gen.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(gen.id)}>
                            <TableCell className="p-2">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {gen.number}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="font-medium truncate">
                                {gen.site_name || gen.prompt.slice(0, 50) + (gen.prompt.length > 50 ? "..." : "")}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{gen.language}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{gen.website_type || "html"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={gen.ai_model === "senior" ? "default" : "outline"}>
                                {gen.ai_model || "junior"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(gen.created_at), "dd.MM.yyyy")}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editedSpends[gen.id]?.amount || "0"}
                                onChange={(e) => handleAmountChange(gen.id, e.target.value)}
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="text"
                                placeholder="Нотатки..."
                                value={editedSpends[gen.id]?.notes || ""}
                                onChange={(e) => handleNotesChange(gen.id, e.target.value)}
                                className="w-40"
                              />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                onClick={() => handleSaveSpend(gen.id)}
                                disabled={saving === gen.id}
                              >
                                {saving === gen.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${gen.id}-expanded`}>
                              <TableCell colSpan={10} className="p-0 bg-muted/30">
                                <div className="p-4 space-y-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Left side - Details */}
                                    <div className="space-y-4">
                                      <div className="h-[300px] flex flex-col">
                                        <h4 className="font-semibold text-sm mb-2">Промпт:</h4>
                                        <div className="flex-1 text-sm text-muted-foreground bg-background p-3 rounded-md border overflow-y-auto">
                                          {gen.prompt}
                                        </div>
                                      </div>
                                      
                                      <div className="text-sm">
                                        <span className="text-muted-foreground">Вартість сайта:</span>
                                        <p className="font-medium">${gen.sale_price?.toFixed(2) || "—"}</p>
                                      </div>
                                    </div>

                                    {/* Right side - Preview */}
                                    <div>
                                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                        <Eye className="h-4 w-4" />
                                        Превʼю сайту:
                                      </h4>
                                      {gen.files_data && gen.files_data.length > 0 ? (
                                        <div className="border rounded-lg overflow-hidden bg-white h-[300px]">
                                          <SimplePreview files={gen.files_data} websiteType={gen.website_type || "html"} />
                                        </div>
                                      ) : (
                                        <div className="border rounded-lg h-[300px] flex items-center justify-center text-muted-foreground">
                                          Немає файлів для превʼю
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Spends;
