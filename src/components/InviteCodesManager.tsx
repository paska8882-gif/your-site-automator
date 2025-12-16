import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Ticket, 
  Plus, 
  Copy, 
  Check, 
  Loader2,
  RefreshCw
} from "lucide-react";

interface InviteCode {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  is_active: boolean;
}

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const InviteCodesManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching codes:", error);
    } else {
      setCodes(data || []);
    }
    setLoading(false);
  };

  const handleGenerateCode = async () => {
    if (!user) return;
    
    setGenerating(true);
    const newCode = generateCode();

    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code: newCode,
        created_by: user.id
      });

    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося створити код",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Код створено",
        description: newCode
      });
      fetchCodes();
    }
    setGenerating(false);
  };

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Скопійовано",
      description: code
    });
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("invite_codes")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося оновити код",
        variant: "destructive"
      });
    } else {
      fetchCodes();
    }
  };

  const stats = {
    total: codes.length,
    active: codes.filter(c => c.is_active && !c.used_by).length,
    used: codes.filter(c => c.used_by).length
  };

  return (
    <Card>
      <CardHeader className="py-2 px-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5" />
            Інвайт-коди
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={fetchCodes} disabled={loading}>
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleGenerateCode} disabled={generating} size="sm" className="h-6 text-xs px-2">
              {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              Створити
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-1.5 rounded-md bg-muted">
            <div className="text-sm font-bold">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Всього</div>
          </div>
          <div className="text-center p-1.5 rounded-md bg-muted">
            <div className="text-sm font-bold text-green-500">{stats.active}</div>
            <div className="text-[10px] text-muted-foreground">Активних</div>
          </div>
          <div className="text-center p-1.5 rounded-md bg-muted">
            <div className="text-sm font-bold text-blue-500">{stats.used}</div>
            <div className="text-[10px] text-muted-foreground">Використано</div>
          </div>
        </div>

        {/* Codes list */}
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : codes.length === 0 ? (
          <p className="text-center text-muted-foreground py-2 text-xs">Немає кодів</p>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {codes.map((code) => (
              <div key={code.id} className="flex items-center justify-between p-1.5 rounded-md border bg-card">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{code.code}</code>
                  {code.used_by ? (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">Використано</Badge>
                  ) : code.is_active ? (
                    <Badge variant="default" className="bg-green-500 text-[10px] px-1 py-0">Активний</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">Неактивний</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{new Date(code.created_at).toLocaleDateString("uk-UA")}</span>
                  {!code.used_by && (
                    <>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleCopyCode(code.code, code.id)}>
                        {copiedId === code.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => handleToggleActive(code.id, code.is_active)}>
                        {code.is_active ? "Деактив" : "Актив"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
