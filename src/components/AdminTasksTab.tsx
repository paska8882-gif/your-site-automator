import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { ClipboardList, Plus, Clock, User, Users, GripVertical, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface AdminTask {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  team_id: string | null;
  assigned_to: string;
  created_by: string;
  deadline: string;
  created_at: string;
  completed_at: string | null;
  assigned_profile?: { display_name: string | null };
  creator_profile?: { display_name: string | null };
  team?: { name: string } | null;
}

interface Admin {
  user_id: string;
  display_name: string | null;
}

interface Team {
  id: string;
  name: string;
}

const statusConfig = {
  todo: { label: "До виконання", color: "bg-amber-600 text-white border-amber-700" },
  in_progress: { label: "В процесі", color: "bg-sky-600 text-white border-sky-700" },
  done: { label: "Виконано", color: "bg-emerald-600 text-white border-emerald-700" },
};

export const AdminTasksTab = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assigned_to: "",
    team_id: "",
  });

  const fetchData = async () => {
    try {
      // Fetch tasks with profiles and teams
      const { data: tasksData, error: tasksError } = await supabase
        .from("admin_tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch profiles for assigned_to and created_by
      const userIds = [...new Set([
        ...(tasksData || []).map(t => t.assigned_to),
        ...(tasksData || []).map(t => t.created_by)
      ])];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      // Fetch teams
      const teamIds = (tasksData || []).filter(t => t.team_id).map(t => t.team_id);
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      const teamsMap = new Map(teamsData?.map(t => [t.id, t]) || []);

      const enrichedTasks = (tasksData || []).map(task => ({
        ...task,
        status: task.status as "todo" | "in_progress" | "done",
        assigned_profile: profilesMap.get(task.assigned_to),
        creator_profile: profilesMap.get(task.created_by),
        team: task.team_id ? teamsMap.get(task.team_id) : null,
      }));

      setTasks(enrichedTasks);

      // Fetch admins
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "super_admin"]);

      if (adminRoles) {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", adminRoles.map(r => r.user_id));

        setAdmins(adminProfiles || []);
      }

      // Fetch all teams
      const { data: allTeams } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      setTeams(allTeams || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("admin-tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_tasks" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createTask = async () => {
    if (!newTask.title || !newTask.assigned_to || !user) {
      toast({ title: "Помилка", description: "Заповніть обов'язкові поля", variant: "destructive" });
      return;
    }

    try {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24);

      const { error } = await supabase.from("admin_tasks").insert({
        title: newTask.title,
        description: newTask.description || null,
        assigned_to: newTask.assigned_to,
        created_by: user.id,
        team_id: newTask.team_id || null,
        deadline: deadline.toISOString(),
      });

      if (error) throw error;

      // Create notification for assigned admin
      if (newTask.assigned_to !== user.id) {
        await supabase.from("notifications").insert({
          user_id: newTask.assigned_to,
          title: "Нове завдання",
          message: `Вам призначено нове завдання: ${newTask.title}`,
          type: "task_assigned",
        });
      }

      toast({ title: "Успішно", description: "Завдання створено" });
      setNewTask({ title: "", description: "", assigned_to: "", team_id: "" });
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error creating task:", error);
      toast({ title: "Помилка", description: "Не вдалося створити завдання", variant: "destructive" });
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: "todo" | "in_progress" | "done") => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "done") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("admin_tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;

      // Notify creator when task is completed
      if (newStatus === "done" && task.created_by !== user?.id) {
        await supabase.from("notifications").insert({
          user_id: task.created_by,
          title: "Завдання виконано",
          message: `Завдання "${task.title}" було виконано`,
          type: "task_completed",
        });
      }

      toast({ title: "Успішно", description: "Статус оновлено" });
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: "Помилка", description: "Не вдалося оновити статус", variant: "destructive" });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("admin_tasks").delete().eq("id", taskId);
      if (error) throw error;
      toast({ title: "Успішно", description: "Завдання видалено" });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Помилка", description: "Не вдалося видалити завдання", variant: "destructive" });
    }
  };

  const isOverdue = (deadline: string) => new Date(deadline) < new Date();

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: "todo" | "in_progress" | "done") => {
    e.preventDefault();
    setDragOverStatus(null);
    
    if (!draggedTaskId) return;
    
    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task || task.status === newStatus) {
      setDraggedTaskId(null);
      return;
    }

    await updateTaskStatus(draggedTaskId, newStatus);
    setDraggedTaskId(null);
  };

  const getCardBackground = (status: "todo" | "in_progress" | "done") => {
    switch (status) {
      case "todo":
        return "bg-amber-200 dark:bg-amber-900/40 hover:bg-amber-300 dark:hover:bg-amber-800/50";
      case "in_progress":
        return "bg-sky-200 dark:bg-sky-900/40 hover:bg-sky-300 dark:hover:bg-sky-800/50";
      case "done":
        return "bg-emerald-200 dark:bg-emerald-900/40 hover:bg-emerald-300 dark:hover:bg-emerald-800/50";
    }
  };

  const renderTaskCard = (task: AdminTask) => (
    <Card 
      key={task.id} 
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      onDragEnd={handleDragEnd}
      className={`mb-3 cursor-grab active:cursor-grabbing transition-all duration-200 ${getCardBackground(task.status)} border ${
        isOverdue(task.deadline) && task.status !== "done" ? "border-red-500/50" : "border-border/50"
      } ${draggedTaskId === task.id ? "opacity-50 scale-95" : "hover:scale-[1.02]"}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
            <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              deleteTask(task.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        {task.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2 ml-6">{task.description}</p>
        )}
        
        <div className="flex flex-wrap gap-1 mb-2 ml-6">
          {task.team && (
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {task.team.name}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 ml-6">
          <User className="h-3 w-3" />
          <span>{task.assigned_profile?.display_name || "Невідомий"}</span>
        </div>
        
        <div className={`flex items-center gap-2 text-xs ml-6 ${isOverdue(task.deadline) && task.status !== "done" ? "text-red-400" : "text-muted-foreground"}`}>
          <Clock className="h-3 w-3" />
          <span>{format(new Date(task.deadline), "dd.MM.yyyy HH:mm", { locale: uk })}</span>
        </div>
      </CardContent>
    </Card>
  );

  const renderColumn = (status: "todo" | "in_progress" | "done") => {
    const columnTasks = tasks.filter(t => t.status === status);
    const config = statusConfig[status];
    const isDragOver = dragOverStatus === status;

    return (
      <div 
        className="flex-1 min-w-[280px]"
        onDragOver={(e) => handleDragOver(e, status)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className={`rounded-lg border ${config.color} p-3 mb-3`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{config.label}</span>
            <Badge variant="secondary" className="text-xs">{columnTasks.length}</Badge>
          </div>
        </div>
        <div className={`space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1 rounded-lg p-2 transition-colors duration-200 ${
          isDragOver ? "bg-primary/10 ring-2 ring-primary/30" : ""
        }`}>
          {columnTasks.map(renderTaskCard)}
          {columnTasks.length === 0 && (
            <p className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors ${
              isDragOver ? "border-primary/50 text-primary bg-primary/5" : "text-muted-foreground border-transparent"
            }`}>
              {isDragOver ? "Відпустіть тут" : "Немає завдань"}
            </p>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Завантаження...</div>;
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <AdminPageHeader
        icon={ClipboardList}
        title="Завдання"
        description="Канбан-дошка для управління завданнями адміністраторів"
      />

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          Всього: {tasks.length} | Активних: {tasks.filter(t => t.status !== "done").length}
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Нове завдання
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Створити завдання</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Назва *</label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Введіть назву завдання"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Опис</label>
                <Textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Введіть опис завдання"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Виконавець *</label>
                <Select value={newTask.assigned_to} onValueChange={(v) => setNewTask({ ...newTask, assigned_to: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть адміністратора" />
                  </SelectTrigger>
                  <SelectContent>
                    {admins.map((admin) => (
                      <SelectItem key={admin.user_id} value={admin.user_id}>
                        {admin.display_name || "Без імені"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Команда (опціонально)</label>
                <Select value={newTask.team_id} onValueChange={(v) => setNewTask({ ...newTask, team_id: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Без команди" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без команди</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <Clock className="h-4 w-4 inline mr-1" />
                Дедлайн буде встановлено автоматично: 24 години від створення
              </div>
              
              <Button onClick={createTask} className="w-full">
                Створити завдання
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {renderColumn("todo")}
        {renderColumn("in_progress")}
        {renderColumn("done")}
      </div>
    </div>
  );
};
