import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Edit2, Save, X } from "lucide-react";

interface Quote {
  id: string;
  text: string;
  author: string | null;
  is_active: boolean;
  created_at: string;
}

export function AdminQuotesTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      toast({
        title: t("common.error"),
        description: t("admin.quotesFetchError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const addQuote = async () => {
    if (!newText.trim()) {
      toast({
        title: t("common.error"),
        description: t("admin.quotesTextPlaceholder"),
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("quotes")
        .insert({
          text: newText.trim(),
          author: newAuthor.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setQuotes(prev => [data, ...prev]);
      setNewText("");
      setNewAuthor("");
      toast({ title: t("admin.quotesAdded") });
    } catch (error) {
      console.error("Error adding quote:", error);
      toast({
        title: t("common.error"),
        description: t("admin.quotesAddError"),
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ is_active: !currentState })
        .eq("id", id);

      if (error) throw error;

      setQuotes(prev =>
        prev.map(q => (q.id === id ? { ...q, is_active: !currentState } : q))
      );
    } catch (error) {
      console.error("Error updating quote:", error);
      toast({
        title: t("common.error"),
        description: t("admin.quotesToggleError"),
        variant: "destructive",
      });
    }
  };

  const startEdit = (quote: Quote) => {
    setEditingId(quote.id);
    setEditText(quote.text);
    setEditAuthor(quote.author || "");
  };

  const saveEdit = async () => {
    if (!editText.trim()) {
      toast({
        title: t("common.error"),
        description: t("admin.quotesTextPlaceholder"),
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("quotes")
        .update({
          text: editText.trim(),
          author: editAuthor.trim() || null,
        })
        .eq("id", editingId);

      if (error) throw error;

      setQuotes(prev =>
        prev.map(q =>
          q.id === editingId
            ? { ...q, text: editText.trim(), author: editAuthor.trim() || null }
            : q
        )
      );
      setEditingId(null);
      toast({ title: t("admin.quotesUpdated") });
    } catch (error) {
      console.error("Error updating quote:", error);
      toast({
        title: t("common.error"),
        description: t("admin.quotesUpdateError"),
        variant: "destructive",
      });
    }
  };

  const deleteQuote = async (id: string) => {
    try {
      const { error } = await supabase.from("quotes").delete().eq("id", id);

      if (error) throw error;

      setQuotes(prev => prev.filter(q => q.id !== id));
      toast({ title: t("admin.quotesDeleted") });
    } catch (error) {
      console.error("Error deleting quote:", error);
      toast({
        title: t("common.error"),
        description: t("admin.quotesDeleteError"),
        variant: "destructive",
      });
    }
  };

  const activeCount = quotes.filter(q => q.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t("admin.quotesTitle")}{" "}
          <span className="text-sm text-muted-foreground">
            ({activeCount} {t("admin.active")})
          </span>
        </h2>
      </div>

      {/* Add new quote */}
      <div className="border rounded-lg p-3 space-y-2">
        <Label className="text-xs">{t("admin.quotesTitle")}</Label>
        <Input
          placeholder={t("admin.quotesTextPlaceholder")}
          value={newText}
          onChange={e => setNewText(e.target.value)}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Input
            placeholder={t("admin.quotesAuthorPlaceholder")}
            value={newAuthor}
            onChange={e => setNewAuthor(e.target.value)}
            className="text-sm flex-1"
          />
          <Button size="sm" onClick={addQuote}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("admin.quotesAdd")}
          </Button>
        </div>
      </div>

      {/* List of quotes */}
      {quotes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("admin.quotesEmpty")}
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map(q => (
            <div
              key={q.id}
              className={`border rounded-lg p-3 ${
                q.is_active ? "bg-background" : "bg-muted/30 opacity-60"
              }`}
            >
              {editingId === q.id ? (
                <div className="space-y-2">
                  <Input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={editAuthor}
                      onChange={e => setEditAuthor(e.target.value)}
                      placeholder="Автор"
                      className="text-sm flex-1"
                    />
                    <Button size="sm" onClick={saveEdit}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm italic">"{q.text}"</p>
                    {q.author && (
                      <p className="text-xs text-muted-foreground mt-1">
                        — {q.author}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={q.is_active}
                      onCheckedChange={() => toggleActive(q.id, q.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEdit(q)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteQuote(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
