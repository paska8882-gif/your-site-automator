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
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Інвайт-коди
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchCodes}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={handleGenerateCode}
              disabled={generating}
              size="sm"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Створити код
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted">
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Всього</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <div className="text-lg font-bold text-green-500">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Активних</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <div className="text-lg font-bold text-blue-500">{stats.used}</div>
            <div className="text-xs text-muted-foreground">Використано</div>
          </div>
        </div>

        {/* Codes list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : codes.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Немає кодів
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {codes.map((code) => (
              <div
                key={code.id}
                className="flex items-center justify-between p-2 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                    {code.code}
                  </code>
                  {code.used_by ? (
                    <Badge variant="secondary">Використано</Badge>
                  ) : code.is_active ? (
                    <Badge variant="default" className="bg-green-500">Активний</Badge>
                  ) : (
                    <Badge variant="outline">Неактивний</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(code.created_at).toLocaleDateString("uk-UA")}
                  </span>
                  {!code.used_by && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyCode(code.code, code.id)}
                      >
                        {copiedId === code.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(code.id, code.is_active)}
                      >
                        {code.is_active ? "Деактивувати" : "Активувати"}
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
