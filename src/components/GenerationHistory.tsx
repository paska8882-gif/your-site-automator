import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2, History, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HistoryItem {
  id: string;
  number: number;
  prompt: string;
  language: string;
  zip_data: string | null;
  created_at: string;
}

export function GenerationHistory() {
  const { toast } = useToast();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("generation_history")
      .select("*")
      .order("number", { ascending: false });

    if (error) {
      console.error("Error fetching history:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити історію",
        variant: "destructive",
      });
    } else {
      setHistory(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDownload = (item: HistoryItem) => {
    if (!item.zip_data) {
      toast({
        title: "Помилка",
        description: "ZIP-файл недоступний",
        variant: "destructive",
      });
      return;
    }

    try {
      const byteCharacters = atob(item.zip_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `website_${item.number}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Завантаження",
        description: "ZIP-архів завантажено",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити файл",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("generation_history")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити запис",
        variant: "destructive",
      });
    } else {
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: "Видалено",
        description: "Запис успішно видалено",
      });
    }
  };

  const truncatePrompt = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  if (history.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Історія генерацій
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">№</TableHead>
                <TableHead>Промпт</TableHead>
                <TableHead className="w-[100px]">Мова</TableHead>
                <TableHead className="w-[180px]">Дата</TableHead>
                <TableHead className="w-[120px] text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.number}</TableCell>
                  <TableCell className="max-w-[300px]">
                    <span title={item.prompt}>{truncatePrompt(item.prompt)}</span>
                  </TableCell>
                  <TableCell>{item.language}</TableCell>
                  <TableCell>
                    {new Date(item.created_at).toLocaleString("uk-UA")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(item)}
                        disabled={!item.zip_data}
                        title="Завантажити ZIP"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        title="Видалити"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
