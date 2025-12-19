import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink, Wallet, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { AdminPageHeader } from "@/components/AdminPageHeader";

interface BalanceRequest {
  id: string;
  user_id: string;
  team_id: string;
  amount: number;
  note: string;
  status: string;
  admin_comment: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  user_display_name?: string;
  team_name?: string;
}

export function AdminBalanceRequestsTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BalanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminComments, setAdminComments] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel("admin-balance-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balance_requests" },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data: requestsData } = await supabase
        .from("balance_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (!requestsData) {
        setRequests([]);
        return;
      }

      // Get user and team info
      const userIds = [...new Set(requestsData.map(r => r.user_id))];
      const teamIds = [...new Set(requestsData.map(r => r.team_id))];

      const [{ data: profiles }, { data: teams }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
        supabase.from("teams").select("id, name").in("id", teamIds)
      ]);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      const teamMap = new Map(teams?.map(t => [t.id, t.name]) || []);

      const enrichedRequests = requestsData.map(r => ({
        ...r,
        user_display_name: profileMap.get(r.user_id) || "Невідомий",
        team_name: teamMap.get(r.team_id) || "Невідома"
      }));

      setRequests(enrichedRequests);
    } catch (error) {
      console.error("Error fetching balance requests:", error);
      toast.error("Помилка завантаження запитів");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: BalanceRequest) => {
    if (!user) return;

    setProcessing(request.id);
    try {
      // Get current team balance
      const { data: teamData } = await supabase
        .from("teams")
        .select("balance")
        .eq("id", request.team_id)
        .single();

      if (!teamData) throw new Error("Team not found");

      const balanceBefore = teamData.balance;
      const newBalance = balanceBefore + request.amount;

      // Create balance transaction record
      const { error: txError } = await supabase.from("balance_transactions").insert({
        team_id: request.team_id,
        amount: request.amount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        note: `Запит #${request.id.slice(0, 8)}: ${request.note}`,
        admin_id: user.id,
      });

      if (txError) throw txError;

      // Update team balance
      const { error: balanceError } = await supabase
        .from("teams")
        .update({ balance: newBalance })
        .eq("id", request.team_id);

      if (balanceError) throw balanceError;

      // Update request status
      const { error: requestError } = await supabase
        .from("balance_requests")
        .update({
          status: "approved",
          admin_comment: adminComments[request.id]?.trim() || null,
          processed_by: user.id,
          processed_at: new Date().toISOString()
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      // Create notification for user
      await supabase.from("notifications").insert({
        user_id: request.user_id,
        title: "Запит на поповнення погоджено",
        message: `Ваш запит на поповнення балансу на $${request.amount.toFixed(2)} було погоджено. Кошти зараховано на баланс команди.`,
        type: "balance_approved",
        data: { request_id: request.id, amount: request.amount }
      });

      toast.success(`Запит на $${request.amount.toFixed(2)} погоджено`);
      setAdminComments(prev => {
        const newComments = { ...prev };
        delete newComments[request.id];
        return newComments;
      });
      fetchRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("Помилка погодження запиту");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: BalanceRequest) => {
    if (!user) return;

    const comment = adminComments[request.id]?.trim();
    if (!comment) {
      toast.error("Вкажіть причину відхилення");
      return;
    }

    setProcessing(request.id);
    try {
      const { error } = await supabase
        .from("balance_requests")
        .update({
          status: "rejected",
          admin_comment: comment,
          processed_by: user.id,
          processed_at: new Date().toISOString()
        })
        .eq("id", request.id);

      if (error) throw error;

      // Create notification for user
      await supabase.from("notifications").insert({
        user_id: request.user_id,
        title: "Запит на поповнення відхилено",
        message: `Ваш запит на поповнення балансу на $${request.amount.toFixed(2)} було відхилено. Причина: ${comment}`,
        type: "balance_rejected",
        data: { request_id: request.id, amount: request.amount, reason: comment }
      });

      toast.success("Запит відхилено");
      setAdminComments(prev => {
        const newComments = { ...prev };
        delete newComments[request.id];
        return newComments;
      });
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Помилка відхилення запиту");
    } finally {
      setProcessing(null);
    }
  };

  const isUrl = (text: string) => {
    try {
      new URL(text);
      return true;
    } catch {
      return text.startsWith("http://") || text.startsWith("https://");
    }
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === "pending") return r.status === "pending";
    if (activeTab === "approved") return r.status === "approved";
    if (activeTab === "rejected") return r.status === "rejected";
    return true;
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const pendingTotal = requests
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + r.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader 
        icon={Wallet} 
        title="Запити на поповнення" 
        description="Обробка запитів на поповнення балансу команд" 
      />
      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-amber-500/10 border-amber-500/30">
          <Clock className="h-3 w-3 text-amber-500" />
          <span className="text-xs text-amber-600">Очікують:</span>
          <span className="text-sm font-bold text-amber-600">{pendingCount}</span>
          <span className="text-xs text-amber-600">•</span>
          <span className="text-sm font-bold text-amber-600">${pendingTotal.toFixed(2)}</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="pending" className="text-xs h-6 px-3">
            Очікують {pendingCount > 0 && `(${pendingCount})`}
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs h-6 px-3">Погоджені</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs h-6 px-3">Відхилені</TabsTrigger>
          <TabsTrigger value="all" className="text-xs h-6 px-3">Всі</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-3">
          {filteredRequests.length === 0 ? (
            <Card className="p-6">
              <div className="text-center text-muted-foreground text-sm">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Немає запитів
              </div>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredRequests.map((request) => (
                  <Card key={request.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        {request.status === "approved" ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : request.status === "rejected" ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Clock className="h-5 w-5 text-amber-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg">${request.amount.toFixed(2)}</span>
                          <Badge
                            variant="outline"
                            className={
                              request.status === "approved"
                                ? "text-green-500 border-green-500/50"
                                : request.status === "rejected"
                                ? "text-destructive border-destructive/50"
                                : "text-amber-500 border-amber-500/50"
                            }
                          >
                            {request.status === "approved"
                              ? "Погоджено"
                              : request.status === "rejected"
                              ? "Відхилено"
                              : "Очікує"}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium">{request.user_display_name}</span>
                          <span className="mx-1">•</span>
                          <span>{request.team_name}</span>
                          <span className="mx-1">•</span>
                          <span>{format(new Date(request.created_at), "d MMM yyyy, HH:mm", { locale: uk })}</span>
                        </div>

                        <div className="text-sm mb-3">
                          <span className="text-muted-foreground">Примітка: </span>
                          {isUrl(request.note) ? (
                            <a
                              href={request.note}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Переглянути квитанцію <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span>{request.note}</span>
                          )}
                        </div>

                        {request.admin_comment && (
                          <div className="p-2 rounded bg-muted text-sm mb-3">
                            <span className="font-medium">Коментар адміна: </span>
                            {request.admin_comment}
                          </div>
                        )}

                        {request.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Коментар (обов'язково для відхилення)"
                              className="h-8 text-sm"
                              value={adminComments[request.id] || ""}
                              onChange={(e) =>
                                setAdminComments((prev) => ({
                                  ...prev,
                                  [request.id]: e.target.value,
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8"
                              onClick={() => handleApprove(request)}
                              disabled={processing === request.id}
                            >
                              {processing === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Погодити
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              onClick={() => handleReject(request)}
                              disabled={processing === request.id}
                            >
                              {processing === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Відхилити
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
