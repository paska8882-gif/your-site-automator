import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Clock,
  MessageSquare,
  Eye
} from "lucide-react";

interface Appeal {
  id: string;
  generation_id: string;
  user_id: string;
  team_id: string;
  reason: string;
  status: string;
  amount_to_refund: number;
  admin_comment: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  // Joined data
  user_name?: string;
  team_name?: string;
  site_name?: string;
  prompt?: string;
}

export function AdminAppealsTab() {
  const { toast } = useToast();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAppeals();
  }, []);

  const fetchAppeals = async () => {
    setLoading(true);

    // Fetch appeals
    const { data: appealsData, error } = await supabase
      .from("appeals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching appeals:", error);
      setLoading(false);
      return;
    }

    if (!appealsData || appealsData.length === 0) {
      setAppeals([]);
      setLoading(false);
      return;
    }

    // Get unique IDs for joins
    const userIds = [...new Set(appealsData.map(a => a.user_id))];
    const teamIds = [...new Set(appealsData.map(a => a.team_id))];
    const generationIds = [...new Set(appealsData.map(a => a.generation_id))];

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    // Fetch teams
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", teamIds);

    // Fetch generations
    const { data: generations } = await supabase
      .from("generation_history")
      .select("id, site_name, prompt")
      .in("id", generationIds);

    // Combine data
    const enrichedAppeals: Appeal[] = appealsData.map(appeal => ({
      ...appeal,
      user_name: profiles?.find(p => p.user_id === appeal.user_id)?.display_name || "Невідомий",
      team_name: teams?.find(t => t.id === appeal.team_id)?.name || "Невідома команда",
      site_name: generations?.find(g => g.id === appeal.generation_id)?.site_name || "Невідомий сайт",
      prompt: generations?.find(g => g.id === appeal.generation_id)?.prompt
    }));

    setAppeals(enrichedAppeals);
    setLoading(false);
  };

  const handleResolve = async (approved: boolean) => {
    if (!selectedAppeal) return;
    
    setProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update appeal status
      const { error: appealError } = await supabase
        .from("appeals")
        .update({
          status: approved ? "approved" : "rejected",
          admin_comment: adminComment || null,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id
        })
        .eq("id", selectedAppeal.id);

      if (appealError) throw appealError;

      // If approved, refund the amount to team balance
      if (approved && selectedAppeal.amount_to_refund > 0) {
        // Get current team balance
        const { data: team } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", selectedAppeal.team_id)
          .single();

        if (team) {
          const newBalance = (team.balance || 0) + selectedAppeal.amount_to_refund;
          
          await supabase
            .from("teams")
            .update({ balance: newBalance })
            .eq("id", selectedAppeal.team_id);
        }
      }

      toast({
        title: "Успішно",
        description: approved 
          ? `Апеляцію схвалено. Повернено $${selectedAppeal.amount_to_refund.toFixed(2)}`
          : "Апеляцію відхилено"
      });

      setSelectedAppeal(null);
      setAdminComment("");
      fetchAppeals();
    } catch (error) {
      console.error("Error resolving appeal:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося обробити апеляцію",
        variant: "destructive"
      });
    }
    
    setProcessing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Очікує</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Схвалено</Badge>;
      case "rejected":
        return <Badge variant="destructive">Відхилено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = appeals.filter(a => a.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 max-w-md">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">Очікують</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <div className="text-2xl font-bold text-green-500">
              {appeals.filter(a => a.status === "approved").length}
            </div>
            <div className="text-xs text-muted-foreground">Схвалено</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <div className="text-2xl font-bold text-destructive">
              {appeals.filter(a => a.status === "rejected").length}
            </div>
            <div className="text-xs text-muted-foreground">Відхилено</div>
          </CardContent>
        </Card>
      </div>

      {/* Appeals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Апеляції ({appeals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appeals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Немає апеляцій
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Статус</TableHead>
                    <TableHead>Користувач</TableHead>
                    <TableHead>Команда</TableHead>
                    <TableHead>Сайт</TableHead>
                    <TableHead>Сума</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appeals.map(appeal => (
                    <TableRow key={appeal.id}>
                      <TableCell>{getStatusBadge(appeal.status)}</TableCell>
                      <TableCell>{appeal.user_name}</TableCell>
                      <TableCell>{appeal.team_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={appeal.site_name}>
                        {appeal.site_name}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${appeal.amount_to_refund.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {new Date(appeal.created_at).toLocaleDateString("uk-UA")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAppeal(appeal);
                            setAdminComment(appeal.admin_comment || "");
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Переглянути
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appeal Detail Dialog */}
      <Dialog open={!!selectedAppeal} onOpenChange={() => setSelectedAppeal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Деталі апеляції</DialogTitle>
          </DialogHeader>
          
          {selectedAppeal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Користувач:</span>
                  <p className="font-medium">{selectedAppeal.user_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Команда:</span>
                  <p className="font-medium">{selectedAppeal.team_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Сайт:</span>
                  <p className="font-medium">{selectedAppeal.site_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Сума до повернення:</span>
                  <p className="font-medium text-lg">${selectedAppeal.amount_to_refund.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground text-sm">Причина апеляції:</span>
                <p className="p-3 bg-muted rounded-md mt-1">{selectedAppeal.reason}</p>
              </div>

              {selectedAppeal.prompt && (
                <div>
                  <span className="text-muted-foreground text-sm">Оригінальний промпт:</span>
                  <p className="p-3 bg-muted rounded-md mt-1 text-sm max-h-32 overflow-y-auto">
                    {selectedAppeal.prompt}
                  </p>
                </div>
              )}

              {selectedAppeal.status === "pending" ? (
                <>
                  <div>
                    <span className="text-muted-foreground text-sm">Коментар адміністратора:</span>
                    <Textarea
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      placeholder="Додати коментар (необов'язково)..."
                      className="mt-1"
                    />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleResolve(false)}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Відхилити
                    </Button>
                    <Button
                      onClick={() => handleResolve(true)}
                      disabled={processing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Схвалити і повернути ${selectedAppeal.amount_to_refund.toFixed(2)}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedAppeal.status)}
                    <span className="font-medium">
                      {selectedAppeal.status === "approved" ? "Схвалено" : "Відхилено"}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {selectedAppeal.resolved_at && new Date(selectedAppeal.resolved_at).toLocaleString("uk-UA")}
                    </span>
                  </div>
                  {selectedAppeal.admin_comment && (
                    <div>
                      <span className="text-muted-foreground text-sm">Коментар адміністратора:</span>
                      <p className="p-3 bg-muted rounded-md mt-1">{selectedAppeal.admin_comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
