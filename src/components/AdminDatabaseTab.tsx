import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Trash2, HardDrive, RefreshCw, CheckCircle2, History, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatabaseGenerationsTable } from "./admin/DatabaseGenerationsTable";

interface DatabaseStats {
  totalGenerations: number;
  withZipData: number;
  withFilesData: number;
  oldWithZip: number;
  oldWithFiles: number;
  oldestRecord: string | null;
  // Storage stats
  totalSize: string;
  tablesSize: string;
  generationHistorySize: string;
  zipDataSize: string;
  tableCount: number;
}

interface CleanupResult {
  success: boolean;
  zipsCleared?: number;
  filesCleared?: number;
  processed?: number;
  retried?: number;
  timestamp: Date;
}

interface CleanupLog {
  id: string;
  created_at: string;
  zips_cleared: number;
  files_cleared: number;
  processed: number;
  retried: number;
  success: boolean;
  error_message: string | null;
  triggered_by: string;
}

export function AdminDatabaseTab() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<CleanupResult | null>(null);
  const [cleanupLogs, setCleanupLogs] = useState<CleanupLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const fetchCleanupLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from("cleanup_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching cleanup logs:", error);
      } else {
        setCleanupLogs(data || []);
      }
    } catch (error) {
      console.error("Error fetching cleanup logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Parallel fetch all counts
      const [
        totalResult,
        withZipResult,
        withFilesResult,
        oldWithZipResult,
        oldWithFilesResult,
        oldestResult
      ] = await Promise.all([
        supabase.from("generation_history").select("*", { count: "exact", head: true }),
        supabase.from("generation_history").select("*", { count: "exact", head: true }).not("zip_data", "is", null),
        supabase.from("generation_history").select("*", { count: "exact", head: true }).not("files_data", "is", null),
        supabase.from("generation_history").select("*", { count: "exact", head: true })
          .lt("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .not("zip_data", "is", null),
        supabase.from("generation_history").select("*", { count: "exact", head: true })
          .lt("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .not("files_data", "is", null),
        supabase.from("generation_history").select("created_at").order("created_at", { ascending: true }).limit(1).single()
      ]);

      // Fetch storage stats via RPC (server-side calculation)
      const { data: storageData } = await supabase.rpc('get_database_storage_stats' as any);
      
      // Default storage values if RPC doesn't exist yet
      const storage = storageData || {
        total_size: 'N/A',
        tables_size: 'N/A', 
        generation_history_size: 'N/A',
        zip_data_size: 'N/A',
        table_count: 0
      };

      setStats({
        totalGenerations: totalResult.count || 0,
        withZipData: withZipResult.count || 0,
        withFilesData: withFilesResult.count || 0,
        oldWithZip: oldWithZipResult.count || 0,
        oldWithFiles: oldWithFilesResult.count || 0,
        oldestRecord: oldestResult.data?.created_at || null,
        // Storage stats
        totalSize: storage.total_size || 'N/A',
        tablesSize: storage.tables_size || 'N/A',
        generationHistorySize: storage.generation_history_size || 'N/A',
        zipDataSize: storage.zip_data_size || 'N/A',
        tableCount: storage.table_count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Помилка завантаження статистики");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCleanupLogs();
  }, []);

  const runCleanup = async () => {
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-stale-generations", {
        headers: { "x-triggered-by": "manual" }
      });
      
      if (error) {
        throw error;
      }

      const result: CleanupResult = {
        success: data.success,
        zipsCleared: data.zipsCleared || 0,
        filesCleared: data.filesCleared || 0,
        processed: data.processed || 0,
        retried: data.retried || 0,
        timestamp: new Date(),
      };

      setLastCleanup(result);

      if (result.success) {
        const clearedTotal = (result.zipsCleared || 0) + (result.filesCleared || 0);
        toast.success(`Очищено ${clearedTotal} zip-файлів`);
        // Refresh stats and logs
        await Promise.all([fetchStats(), fetchCleanupLogs()]);
      } else {
        toast.error("Помилка очищення");
      }
    } catch (error) {
      console.error("Error running cleanup:", error);
      toast.error("Помилка виклику функції очищення");
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            База даних
          </h2>
          <p className="text-muted-foreground text-sm">
            Статистика та очищення старих zip-файлів
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Оновити
          </Button>
          <Button onClick={runCleanup} disabled={cleaning} variant="destructive">
            {cleaning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Очистити старі zip
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всього генерацій
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalGenerations.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              З zip_data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.withZipData.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats && stats.totalGenerations > 0 
                ? `${((stats.withZipData / stats.totalGenerations) * 100).toFixed(1)}% від усіх`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">
              Старші 2 тижнів (zip)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats?.oldWithZip.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Готові до очищення
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">
              Старші 2 тижнів (files)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats?.oldWithFiles.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Готові до очищення
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Storage Size Info */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Розмір сховища
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-background rounded-lg border">
              <div className="text-2xl font-bold text-primary">{stats?.totalSize || 'N/A'}</div>
              <div className="text-xs text-muted-foreground mt-1">Загальний розмір БД</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <div className="text-2xl font-bold">{stats?.generationHistorySize || 'N/A'}</div>
              <div className="text-xs text-muted-foreground mt-1">generation_history</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border border-amber-500/30">
              <div className="text-2xl font-bold text-amber-600">{stats?.zipDataSize || 'N/A'}</div>
              <div className="text-xs text-muted-foreground mt-1">ZIP дані</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <div className="text-2xl font-bold">{stats?.tableCount || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Таблиць</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            Інформація про сховище
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Найстаріший запис</span>
            <span className="font-medium">
              {stats?.oldestRecord 
                ? format(new Date(stats.oldestRecord), "dd.MM.yyyy HH:mm")
                : "—"}
            </span>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Автоочищення</span>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              Кожні 14 днів
            </Badge>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Очищуються</span>
            <span className="text-sm">zip_data, files_data</span>
          </div>
        </CardContent>
      </Card>

      {/* Generations Table with Filters */}
      <DatabaseGenerationsTable onCleanupComplete={() => {
        fetchStats();
        fetchCleanupLogs();
      }} />

      {/* Last Cleanup Result */}
      {lastCleanup && (
        <Card className={lastCleanup.success ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {lastCleanup.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Trash2 className="h-5 w-5 text-red-600" />
              )}
              Останнє очищення
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Час</p>
                <p className="font-medium">
                  {format(lastCleanup.timestamp, "HH:mm:ss")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Zip очищено</p>
                <p className="font-medium text-green-600">
                  {lastCleanup.zipsCleared || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Files очищено</p>
                <p className="font-medium text-green-600">
                  {lastCleanup.filesCleared || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Статус</p>
                <Badge variant={lastCleanup.success ? "default" : "destructive"}>
                  {lastCleanup.success ? "Успішно" : "Помилка"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cleanup History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Історія очищень
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : cleanupLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Немає записів про очищення
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Час</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-center">ZIP</TableHead>
                    <TableHead className="text-center">Files</TableHead>
                    <TableHead className="text-center">Оброблено</TableHead>
                    <TableHead className="text-center">Повтор</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cleanupLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.triggered_by === "manual" ? "Ручний" : "Cron"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium text-green-600">
                        {log.zips_cleared}
                      </TableCell>
                      <TableCell className="text-center font-medium text-green-600">
                        {log.files_cleared}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.processed}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.retried}
                      </TableCell>
                      <TableCell>
                        {log.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-red-600" />
                            {log.error_message && (
                              <span className="text-xs text-red-600 truncate max-w-[100px]" title={log.error_message}>
                                {log.error_message}
                              </span>
                            )}
                          </div>
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
    </div>
  );
}
