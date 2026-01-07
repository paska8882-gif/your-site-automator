import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { TaskDetailsDialog } from "@/components/TaskDetailsDialog";
import { ClipboardList, Plus, Clock, User, Users, GripVertical, Trash2, LayoutGrid, List, ChevronDown, UserCheck, Send, Flag, Filter, Pencil, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

type TaskPriority = "low" | "medium" | "high";

interface AdminTask {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "problematic";
  priority: TaskPriority;
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

const getStatusConfig = (t: (key: string) => string) => ({
  todo: { label: t("admin.statusTodo"), color: "bg-gradient-to-r from-slate-500 to-slate-600 text-white border-slate-700 shadow-lg" },
  in_progress: { label: t("admin.statusInProgress"), color: "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-700 shadow-lg" },
  done: { label: t("admin.statusDone"), color: "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-700 shadow-lg" },
  problematic: { label: t("admin.statusProblematic"), color: "bg-gradient-to-r from-red-500 to-red-600 text-white border-red-700 shadow-lg" },
});

const getPriorityConfig = (t: (key: string) => string) => ({
  low: { label: t("admin.priorityLow"), color: "text-slate-300", bgColor: "bg-slate-600/50", icon: "border-l-slate-400" },
  medium: { label: t("admin.priorityMedium"), color: "text-amber-300", bgColor: "bg-amber-600/50", icon: "border-l-amber-400" },
  high: { label: t("admin.priorityHigh"), color: "text-red-300", bgColor: "bg-red-600/50", icon: "border-l-red-400" },
});

export const AdminTasksTab = () => {
  const { user } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { t } = useLanguage();
  const statusConfig = getStatusConfig(t);
  const priorityConfig = getPriorityConfig(t);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [kanbanFilter, setKanbanFilter] = useState<"all" | "assigned" | "created">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    assigned: true,
    created: true,
    all: true,
  });
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assigned_to: "",
    team_id: "",
    priority: "medium" as TaskPriority,
  });
  const [editTask, setEditTask] = useState({
    title: "",
    description: "",
    assigned_to: "",
    team_id: "",
    priority: "medium" as TaskPriority,
  });
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [detailsTaskTitle, setDetailsTaskTitle] = useState("");

  // Filter tasks based on user role and priority
  const roleFilteredTasks = isSuperAdmin 
    ? tasks 
    : tasks.filter(t => t.assigned_to === user?.id || t.created_by === user?.id);

  const filteredTasks = priorityFilter === "all" 
    ? roleFilteredTasks 
    : roleFilteredTasks.filter(t => t.priority === priorityFilter);

  const myAssignedTasks = filteredTasks.filter(t => t.assigned_to === user?.id);
  const myCreatedTasks = filteredTasks.filter(t => t.created_by === user?.id && t.assigned_to !== user?.id);

  const fetchData = async () => {
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from("admin_tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;

      const userIds = [...new Set([
        ...(tasksData || []).map(t => t.assigned_to),
        ...(tasksData || []).map(t => t.created_by)
      ])];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      const teamIds = (tasksData || []).filter(t => t.team_id).map(t => t.team_id);
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      const teamsMap = new Map(teamsData?.map(t => [t.id, t]) || []);

      const enrichedTasks = (tasksData || []).map(task => ({
        ...task,
        status: task.status as "todo" | "in_progress" | "done" | "problematic",
        priority: (task.priority || "medium") as TaskPriority,
        assigned_profile: profilesMap.get(task.assigned_to),
        creator_profile: profilesMap.get(task.created_by),
        team: task.team_id ? teamsMap.get(task.team_id) : null,
      }));

      setTasks(enrichedTasks);

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
      toast({ title: t("common.error"), description: t("admin.fillRequired"), variant: "destructive" });
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
        priority: newTask.priority,
        deadline: deadline.toISOString(),
      });

      if (error) throw error;

      if (newTask.assigned_to !== user.id) {
        await supabase.from("notifications").insert({
          user_id: newTask.assigned_to,
          title: t("admin.taskAssigned"),
          message: `${t("admin.taskAssignedMsg")}: ${newTask.title}`,
          type: "task_assigned",
        });
      }

      toast({ title: t("common.success"), description: t("admin.taskCreated") });
      setNewTask({ title: "", description: "", assigned_to: "", team_id: "", priority: "medium" });
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error creating task:", error);
      toast({ title: t("common.error"), description: t("admin.createError"), variant: "destructive" });
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: "todo" | "in_progress" | "done" | "problematic") => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const oldStatus = task.status;
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "done") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("admin_tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;

      // Record status change history
      await supabase.from("task_status_history").insert({
        task_id: taskId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: user?.id,
      });

      if (newStatus === "done" && task.created_by !== user?.id) {
        await supabase.from("notifications").insert({
          user_id: task.created_by,
          title: t("admin.taskCompleted"),
          message: `${t("admin.taskCompletedMsg")}: "${task.title}"`,
          type: "task_completed",
        });
      }

      toast({ title: t("common.success"), description: t("admin.statusUpdated") });
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: t("common.error"), description: t("admin.statusError"), variant: "destructive" });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("admin_tasks").delete().eq("id", taskId);
      if (error) throw error;
      toast({ title: t("common.success"), description: t("admin.taskDeleted") });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: t("common.error"), description: t("admin.deleteError"), variant: "destructive" });
    }
  };

  const openEditDialog = (task: AdminTask) => {
    setEditingTask(task);
    setEditTask({
      title: task.title,
      description: task.description || "",
      assigned_to: task.assigned_to,
      team_id: task.team_id || "",
      priority: task.priority,
    });
    setIsEditDialogOpen(true);
  };

  const updateTask = async () => {
    if (!editingTask || !editTask.title || !editTask.assigned_to) {
      toast({ title: t("common.error"), description: t("admin.fillRequired"), variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from("admin_tasks")
        .update({
          title: editTask.title,
          description: editTask.description || null,
          assigned_to: editTask.assigned_to,
          team_id: editTask.team_id || null,
          priority: editTask.priority,
        })
        .eq("id", editingTask.id);

      if (error) throw error;

      // Notify new assignee if changed
      if (editTask.assigned_to !== editingTask.assigned_to && editTask.assigned_to !== user?.id) {
        await supabase.from("notifications").insert({
          user_id: editTask.assigned_to,
          title: t("admin.taskReassigned"),
          message: `${t("admin.taskReassignedMsg")}: ${editTask.title}`,
          type: "task_assigned",
        });
      }

      toast({ title: t("common.success"), description: t("admin.taskUpdated") });
      setIsEditDialogOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: t("common.error"), description: t("admin.updateError"), variant: "destructive" });
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

  const handleDrop = async (e: React.DragEvent, newStatus: "todo" | "in_progress" | "done" | "problematic") => {
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

  const getCardBackground = (status: "todo" | "in_progress" | "done" | "problematic") => {
    switch (status) {
      case "todo":
        return "bg-slate-800/60 hover:bg-slate-700/70";
      case "in_progress":
        return "bg-blue-900/60 hover:bg-blue-800/70";
      case "done":
        return "bg-emerald-900/60 hover:bg-emerald-800/70";
      case "problematic":
        return "bg-red-900/60 hover:bg-red-800/70";
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const renderTaskCard = (task: AdminTask, showDragHandle = true) => (
    <Card 
      key={task.id} 
      draggable={showDragHandle}
      onDragStart={(e) => handleDragStart(e, task.id)}
      onDragEnd={handleDragEnd}
      className={`mb-3 ${showDragHandle ? "cursor-grab active:cursor-grabbing" : ""} transition-all duration-200 ${getCardBackground(task.status)} border-l-4 ${priorityConfig[task.priority].icon} border ${
        isOverdue(task.deadline) && task.status !== "done" ? "border-red-500/50" : "border-border/50"
      } ${draggedTaskId === task.id ? "opacity-50 scale-95" : "hover:scale-[1.02]"}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-2">
          {showDragHandle && <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
          </div>
        </div>
        
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <Badge className={`text-xs ${statusConfig[task.status].color}`}>
            {statusConfig[task.status].label}
          </Badge>
          <div className="flex items-center gap-0.5 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-blue-500"
              onClick={(e) => {
                e.stopPropagation();
                setDetailsTaskId(task.id);
                setDetailsTaskTitle(task.title);
              }}
            >
              <MessageCircle className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                openEditDialog(task);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteTask(task.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {task.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
        )}
        
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className={`text-xs ${priorityConfig[task.priority].bgColor} ${priorityConfig[task.priority].color} border-0`}>
            <Flag className="h-3 w-3 mr-1" />
            {priorityConfig[task.priority].label}
          </Badge>
          {task.team && (
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {task.team.name}
            </Badge>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserCheck className="h-3 w-3" />
            <span>{task.assigned_profile?.display_name || t("admin.unknownUser")}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Send className="h-3 w-3" />
            <span>{task.creator_profile?.display_name || t("admin.unknownUser")}</span>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 text-xs ${isOverdue(task.deadline) && task.status !== "done" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
          <Clock className="h-3 w-3" />
          <span>{format(new Date(task.deadline), "dd.MM.yyyy HH:mm", { locale: uk })}</span>
        </div>

        {task.status !== "done" && viewMode === "list" && (
          <div className="mt-3 flex gap-1">
            {(task.status === "todo" || task.status === "problematic") && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateTaskStatus(task.id, "in_progress")}>
                {t("admin.start")}
              </Button>
            )}
            {task.status === "in_progress" && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateTaskStatus(task.id, "done")}>
                {t("admin.finish")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const getKanbanFilteredTasks = () => {
    switch (kanbanFilter) {
      case "assigned":
        return myAssignedTasks;
      case "created":
        return myCreatedTasks;
      default:
        return filteredTasks;
    }
  };

  const renderColumn = (status: "todo" | "in_progress" | "done" | "problematic") => {
    const kanbanTasks = getKanbanFilteredTasks();
    const columnTasks = kanbanTasks.filter(t => t.status === status);
    const config = statusConfig[status];
    const isDragOver = dragOverStatus === status;

    return (
      <div 
        className="flex-1 min-w-0"
        onDragOver={(e) => handleDragOver(e, status)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className={`rounded-xl border ${config.color} p-3 mb-3 shadow-lg`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{config.label}</span>
            <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">{columnTasks.length}</Badge>
          </div>
        </div>
        <div className={`space-y-2 max-h-[calc(100vh-450px)] overflow-y-auto overflow-x-hidden rounded-lg p-2 transition-colors duration-200 scrollbar-hide ${
          isDragOver ? "bg-primary/10 ring-2 ring-primary/30" : ""
        }`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {columnTasks.map(task => renderTaskCard(task))}
          {columnTasks.length === 0 && (
            <p className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors ${
              isDragOver ? "border-primary/50 text-primary bg-primary/5" : "text-muted-foreground border-transparent"
            }`}>
              {isDragOver ? t("admin.dropHere") : t("admin.noTasks")}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderListGroup = (title: string, icon: React.ReactNode, groupKey: string, taskList: AdminTask[]) => (
    <Collapsible open={expandedGroups[groupKey]} onOpenChange={() => toggleGroup(groupKey)} className="mb-4">
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-xl bg-gradient-to-r from-muted/50 to-muted hover:from-muted hover:to-muted/80 transition-all shadow-sm">
        <ChevronDown className={`h-4 w-4 transition-transform ${expandedGroups[groupKey] ? "" : "-rotate-90"}`} />
        {icon}
        <span className="font-medium">{title}</span>
        <Badge variant="secondary" className="ml-auto">{taskList.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-2">
        {taskList.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">{t("admin.noTasks")}</p>
        ) : (
          taskList.map(task => renderTaskCard(task, false))
        )}
      </CollapsibleContent>
    </Collapsible>
  );

  const renderListView = () => (
    <div className="space-y-4 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-350px)] scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {renderListGroup(
        t("admin.assignedToMe"),
        <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
        "assigned",
        myAssignedTasks
      )}
      {renderListGroup(
        t("admin.createdByMe"),
        <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
        "created",
        myCreatedTasks
      )}
      {isSuperAdmin && renderListGroup(
        t("admin.allTasks"),
        <Users className="h-4 w-4 text-slate-500" />,
        "all",
        filteredTasks
      )}
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64">{t("common.loading")}</div>;
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <AdminPageHeader
        icon={ClipboardList}
        title={t("admin.tasksTitle")}
        description={t("admin.tasksDescription")}
      />

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {t("admin.total")}: {filteredTasks.length} | {t("admin.active")}: {filteredTasks.filter(t => t.status !== "done").length}
          </div>
          
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("kanban")}
              title={t("admin.kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("list")}
              title={t("admin.list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {viewMode === "kanban" && (
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={kanbanFilter === "all" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setKanbanFilter("all")}
              >
                <Users className="h-3 w-3 mr-1" />
                {t("admin.filterAll")}
              </Button>
              <Button
                variant={kanbanFilter === "assigned" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setKanbanFilter("assigned")}
              >
                <UserCheck className="h-3 w-3 mr-1" />
                {t("admin.filterAssignedMe")}
              </Button>
              <Button
                variant={kanbanFilter === "created" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setKanbanFilter("created")}
              >
                <Send className="h-3 w-3 mr-1" />
                {t("admin.filterFromMe")}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Filter className="h-3 w-3 text-muted-foreground ml-1" />
            <Button
              variant={priorityFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setPriorityFilter("all")}
            >
              {t("admin.filterAll")}
            </Button>
            <Button
              variant={priorityFilter === "high" ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-2 text-xs ${priorityFilter !== "high" ? "text-red-500" : ""}`}
              onClick={() => setPriorityFilter("high")}
            >
              <Flag className="h-3 w-3 mr-1" />
              {t("admin.priorityHigh")}
            </Button>
            <Button
              variant={priorityFilter === "medium" ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-2 text-xs ${priorityFilter !== "medium" ? "text-amber-500" : ""}`}
              onClick={() => setPriorityFilter("medium")}
            >
              <Flag className="h-3 w-3 mr-1" />
              {t("admin.priorityMedium")}
            </Button>
            <Button
              variant={priorityFilter === "low" ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-2 text-xs ${priorityFilter !== "low" ? "text-slate-500" : ""}`}
              onClick={() => setPriorityFilter("low")}
            >
              <Flag className="h-3 w-3 mr-1" />
              {t("admin.priorityLow")}
            </Button>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg">
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.newTask")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.createTask")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.taskTitle")} *</label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder={t("admin.taskTitlePlaceholder")}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.taskDescription")}</label>
                <Textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder={t("admin.taskDescriptionPlaceholder")}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.executor")} *</label>
                <Select value={newTask.assigned_to} onValueChange={(v) => setNewTask({ ...newTask, assigned_to: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.selectAdmin")} />
                  </SelectTrigger>
                  <SelectContent>
                    {admins.map((admin) => (
                      <SelectItem key={admin.user_id} value={admin.user_id}>
                        {admin.display_name || t("admin.noName")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.teamOptional")}</label>
                <Select value={newTask.team_id} onValueChange={(v) => setNewTask({ ...newTask, team_id: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.noTeam")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("admin.noTeam")}</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.priority")}</label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as TaskPriority })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.priorityMedium")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-slate-500" />
                        {t("admin.priorityLow")}
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-amber-500" />
                        {t("admin.priorityMedium")}
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-red-500" />
                        {t("admin.priorityHigh")}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <Clock className="h-4 w-4 inline mr-1" />
                {t("admin.deadlineAuto")}
              </div>
              
              <Button onClick={createTask} className="w-full">
                {t("admin.createTask")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.editTask")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.taskTitle")} *</label>
                <Input
                  value={editTask.title}
                  onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                  placeholder={t("admin.taskTitlePlaceholder")}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.taskDescription")}</label>
                <Textarea
                  value={editTask.description}
                  onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                  placeholder={t("admin.taskDescriptionPlaceholder")}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.executor")} *</label>
                <Select value={editTask.assigned_to} onValueChange={(v) => setEditTask({ ...editTask, assigned_to: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.selectAdmin")} />
                  </SelectTrigger>
                  <SelectContent>
                    {admins.map((admin) => (
                      <SelectItem key={admin.user_id} value={admin.user_id}>
                        {admin.display_name || t("admin.noName")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.teamOptional")}</label>
                <Select value={editTask.team_id || "none"} onValueChange={(v) => setEditTask({ ...editTask, team_id: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.noTeam")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("admin.noTeam")}</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t("admin.priority")}</label>
                <Select value={editTask.priority} onValueChange={(v) => setEditTask({ ...editTask, priority: v as TaskPriority })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.priorityMedium")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-slate-500" />
                        {t("admin.priorityLow")}
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-amber-500" />
                        {t("admin.priorityMedium")}
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-red-500" />
                        {t("admin.priorityHigh")}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={updateTask} className="w-full">
                {t("common.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {renderColumn("problematic")}
          {renderColumn("todo")}
          {renderColumn("in_progress")}
          {renderColumn("done")}
        </div>
      ) : (
        renderListView()
      )}

      <TaskDetailsDialog
        taskId={detailsTaskId}
        taskTitle={detailsTaskTitle}
        isOpen={!!detailsTaskId}
        onClose={() => setDetailsTaskId(null)}
      />
    </div>
  );
};
