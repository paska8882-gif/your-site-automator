import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, CheckCircle, XCircle, ExternalLink, Wallet, Users } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface BalanceRequest {
  id: string;
  amount: number;
  note: string;
  status: string;
  admin_comment: string | null;
  created_at: string;
  processed_at: string | null;
  user_display_name?: string;
}

interface BalanceRequestsListProps {
  requests: BalanceRequest[];
  loading?: boolean;
  showUserName?: boolean;
  title?: string;
}

export function BalanceRequestsList({ requests, loading, showUserName = false, title = "Історія запитів на поповнення" }: BalanceRequestsListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="outline" className="text-green-500 border-green-500/50 text-[10px]">Погоджено</Badge>;
      case "rejected":
        return <Badge variant="outline" className="text-destructive border-destructive/50 text-[10px]">Відхилено</Badge>;
      default:
        return <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-[10px]">Відправлено</Badge>;
    }
  };

  const pendingTotal = requests
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + r.amount, 0);

  const approvedTotal = requests
    .filter(r => r.status === "approved")
    .reduce((sum, r) => sum + r.amount, 0);

  const rejectedTotal = requests
    .filter(r => r.status === "rejected")
    .reduce((sum, r) => sum + r.amount, 0);

  // Check if string looks like a URL
  const isUrl = (text: string) => {
    try {
      new URL(text);
      return true;
    } catch {
      return text.startsWith("http://") || text.startsWith("https://");
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        {showUserName ? <Users className="h-4 w-4 text-primary" /> : <Wallet className="h-4 w-4 text-primary" />}
        <h3 className="font-medium text-sm">{title}</h3>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <div className="text-[10px] text-amber-600">Відправлено</div>
          <div className="font-bold text-sm text-amber-600">${pendingTotal.toFixed(2)}</div>
        </div>
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
          <div className="text-[10px] text-green-600">Погоджено</div>
          <div className="font-bold text-sm text-green-600">${approvedTotal.toFixed(2)}</div>
        </div>
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
          <div className="text-[10px] text-destructive">Відхилено</div>
          <div className="font-bold text-sm text-destructive">${rejectedTotal.toFixed(2)}</div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Немає запитів на поповнення
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="shrink-0 mt-0.5">{getStatusIcon(request.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">${request.amount.toFixed(2)}</span>
                        {showUserName && request.user_display_name && (
                          <span className="text-xs text-muted-foreground">• {request.user_display_name}</span>
                        )}
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {format(new Date(request.created_at), "d MMM yyyy, HH:mm", { locale: uk })}
                    </div>
                    <div className="text-xs">
                      {isUrl(request.note) ? (
                        <a 
                          href={request.note} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Квитанція <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{request.note}</span>
                      )}
                    </div>
                    {request.admin_comment && (
                      <div className="mt-2 p-2 rounded bg-muted text-xs">
                        <span className="font-medium">Коментар адміна: </span>
                        {request.admin_comment}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
