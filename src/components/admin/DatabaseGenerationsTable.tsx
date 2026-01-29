import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, FileArchive, Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Generation {
  id: string;
  number: number;
  created_at: string;
  site_name: string | null;
  status: string;
  team_id: string | null;
  has_zip: boolean;
  has_files: boolean;
}

interface Team {
  id: string;
  name: string;
}

interface Props {
  onCleanupComplete: () => void;
}

export function DatabaseGenerationsTable({ onCleanupComplete }: Props) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [dataFilter, setDataFilter] = useState<string>("with_data");
  
  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const fetchTeams = useCallback(async () => {
    const { data } = await supabase.from("teams").select("id, name").order("name");
    if (data) setTeams(data);
  }, []);

  const fetchGenerations = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("generation_history")
        .select("id, number, created_at, site_name, status, team_id, zip_data, files_data", { count: "exact" });

      // Apply filters
      if (teamFilter !== "all") {
        query = query.eq("team_id", teamFilter);
      }

      if (periodFilter !== "all") {
        const now = new Date();
        let dateFrom: Date;
        
        switch (periodFilter) {
          case "today":
            dateFrom = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "old":
            query = query.lt("created_at", new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString());
            break;
          default:
            dateFrom = new Date(0);
        }
        
        if (periodFilter !== "old" && dateFrom!) {
          query = query.gte("created_at", dateFrom.toISOString());
        }
      }

      if (dataFilter === "with_data") {
        query = query.or("zip_data.neq.null,files_data.neq.null");
      } else if (dataFilter === "zip_only") {
        query = query.not("zip_data", "is", null);
      } else if (dataFilter === "files_only") {
        query = query.not("files_data", "is", null);
      }

      query = query
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      const { data, count, error } = await query;

      if (error) {
        console.error("Error fetching generations:", error);
        toast.error("Помилка завантаження");
        return;
      }

      const mapped = (data || []).map((g: any) => ({
        id: g.id,
        number: g.number,
        created_at: g.created_at,
        site_name: g.site_name,
        status: g.status,
        team_id: g.team_id,
        has_zip: g.zip_data !== null,
        has_files: g.files_data !== null,
      }));

      setGenerations(mapped);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, [teamFilter, periodFilter, dataFilter, page]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [teamFilter, periodFilter, dataFilter]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === generations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(generations.map(g => g.id)));
    }
  };

  const clearSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error("Виберіть записи для очищення");
      return;
    }

    setCleaning(true);
    try {
      const ids = Array.from(selectedIds);
      
      const { error } = await supabase
        .from("generation_history")
        .update({ zip_data: null, files_data: null })
        .in("id", ids);

      if (error) {
        throw error;
      }

      toast.success(`Очищено ${ids.length} записів`);
      setSelectedIds(new Set());
      await fetchGenerations();
      onCleanupComplete();
    } catch (error) {
      console.error("Error clearing data:", error);
      toast.error("Помилка очищення");
    } finally {
      setCleaning(false);
    }
  };

  const clearByFilter = async () => {
    setCleaning(true);
    try {
      let query = supabase.from("generation_history").select("id");

      // Apply same filters
      if (teamFilter !== "all") {
        query = query.eq("team_id", teamFilter);
      }

      if (periodFilter === "old") {
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        query = query.lt("created_at", twoWeeksAgo);
      } else if (periodFilter !== "all") {
        const now = new Date();
        let dateFrom: Date;
        
        switch (periodFilter) {
          case "today":
            dateFrom = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            dateFrom = new Date(0);
        }
        
        if (dateFrom!) {
          query = query.gte("created_at", dateFrom.toISOString());
        }
      }

      if (dataFilter === "with_data") {
        query = query.or("zip_data.neq.null,files_data.neq.null");
      } else if (dataFilter === "zip_only") {
        query = query.not("zip_data", "is", null);
      } else if (dataFilter === "files_only") {
        query = query.not("files_data", "is", null);
      }

      const { data: idsToUpdate, error: fetchErr } = await query;

      if (fetchErr) {
        throw fetchErr;
      }

      if (!idsToUpdate || idsToUpdate.length === 0) {
        toast.info("Немає записів для очищення");
        return;
      }

      const ids = idsToUpdate.map(r => r.id);

      const { error } = await supabase
        .from("generation_history")
        .update({ zip_data: null, files_data: null })
        .in("id", ids);

      if (error) {
        throw error;
      }

      toast.success(`Очищено ${ids.length} записів за фільтром`);
      setSelectedIds(new Set());
      await fetchGenerations();
      onCleanupComplete();
    } catch (error) {
      console.error("Error clearing by filter:", error);
      toast.error("Помилка масового очищення");
    } finally {
      setCleaning(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          Генерації з даними ({totalCount})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Команда" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі команди</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Період" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Весь час</SelectItem>
                <SelectItem value="today">Сьогодні</SelectItem>
                <SelectItem value="week">Останній тиждень</SelectItem>
                <SelectItem value="month">Останній місяць</SelectItem>
                <SelectItem value="old">Старше 2 тижнів</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <FileArchive className="h-4 w-4 text-muted-foreground" />
            <Select value={dataFilter} onValueChange={setDataFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Дані" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="with_data">З даними</SelectItem>
                <SelectItem value="zip_only">Тільки ZIP</SelectItem>
                <SelectItem value="files_only">Тільки Files</SelectItem>
                <SelectItem value="any">Будь-які</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={clearSelected}
            disabled={cleaning || selectedIds.size === 0}
          >
            {cleaning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Очистити вибрані ({selectedIds.size})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearByFilter}
            disabled={cleaning}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Очистити все за фільтром
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : generations.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Немає записів за обраними фільтрами
          </p>
        ) : (
          <>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === generations.length && generations.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>Назва</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-center">ZIP</TableHead>
                    <TableHead className="text-center">Files</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generations.map((gen) => (
                    <TableRow key={gen.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(gen.id)}
                          onCheckedChange={() => toggleSelect(gen.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {gen.number}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={gen.site_name || "—"}>
                        {gen.site_name || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(gen.created_at), "dd.MM.yy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={gen.status === "completed" ? "default" : "secondary"} className="text-xs">
                          {gen.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {gen.has_zip ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                            ZIP
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {gen.has_files ? (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                            Files
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Показано {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} з {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page + 1} / {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
