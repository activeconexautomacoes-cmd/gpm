import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useMemo } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle, ListChecks, User, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface OpportunityChecklistProps {
  opportunityId: string;
}

export function OpportunityChecklist({ opportunityId }: OpportunityChecklistProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["opportunity-checklist", opportunityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select(`
          id, title, description, status, priority,
          assignee_id, template_item_id, deadline_at, sla_deadline_at, sla_status, completed_at,
          created_at,
          assignee:assignee_id (id, full_name),
          template_item:template_item_id (id, default_assignee_role)
        `)
        .eq("opportunity_id", opportunityId)
        .eq("type", "checklist")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!opportunityId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await (supabase as any)
        .from("tasks")
        .update({
          status: done ? "done" : "todo",
          completed_at: done ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      return { id, done };
    },
    onSuccess: (_data, { id, done }) => {
      // Update checklist list locally (don't refetch opportunities to avoid closing dialog)
      queryClient.setQueryData(["opportunity-checklist", opportunityId], (old: any[]) => {
        if (!old) return old;
        return old.map((t: any) =>
          t.id === id ? { ...t, status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null } : t
        );
      });
      // Refresh checklist tasks in CRM tab (background, doesn't affect dialog)
      queryClient.invalidateQueries({ queryKey: ["crm-checklist-tasks"] });
    },
  });

  const [expanded, setExpanded] = useState(true);

  // Group tasks by role
  const groups = useMemo(() => {
    const sdrTasks: any[] = [];
    const closerTasks: any[] = [];
    const otherTasks: any[] = [];

    tasks.forEach((task: any) => {
      const role = task.template_item?.default_assignee_role;
      if (role === "sdr") sdrTasks.push(task);
      else if (role === "closer") closerTasks.push(task);
      else otherTasks.push(task);
    });

    const result: { label: string; color: string; tasks: any[] }[] = [];
    if (sdrTasks.length > 0) result.push({ label: "SDR", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", tasks: sdrTasks });
    if (closerTasks.length > 0) result.push({ label: "Closer", color: "text-orange-500 bg-orange-500/10 border-orange-500/20", tasks: closerTasks });
    if (otherTasks.length > 0) result.push({ label: "Outros", color: "text-slate-500 bg-slate-500/10 border-slate-500/20", tasks: otherTasks });
    return result;
  }, [tasks]);

  if (isLoading || tasks.length === 0) return null;

  const doneCount = tasks.filter((t: any) => t.status === "done").length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ListChecks className="h-4 w-4 text-indigo-500" />
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground">
            Checklist
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-black px-2 py-0 h-5 rounded-full",
              doneCount === totalCount
                ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                : "border-indigo-500/30 text-indigo-500 bg-indigo-500/5"
            )}
          >
            {doneCount}/{totalCount}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                doneCount === totalCount ? "bg-emerald-500" : "bg-indigo-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Grouped items */}
      {expanded && (
        <div className="border-t border-border">
          {groups.map((group) => {
            const groupDone = group.tasks.filter((t: any) => t.status === "done").length;
            return (
              <div key={group.label}>
                {/* Group header */}
                <div className="px-5 py-2 bg-muted/20 flex items-center justify-between border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0 h-4 rounded-md border", group.color)}>
                      {group.label}
                    </Badge>
                  </div>
                  <span className="text-[9px] font-bold text-muted-foreground">
                    {groupDone}/{group.tasks.length}
                  </span>
                </div>

                {/* Group tasks */}
                <div className="divide-y divide-border/30">
                  {group.tasks.map((task: any) => (
                    <TaskItem key={task.id} task={task} onToggle={toggleMutation.mutate} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskItem({ task, onToggle }: { task: any; onToggle: (args: { id: string; done: boolean }) => void }) {
  const isDone = task.status === "done";
  const isOverdue = !isDone && task.deadline_at && isPast(parseISO(task.deadline_at));
  const slaWarning = !isDone && task.sla_status === "warning";
  const slaOverdue = !isDone && task.sla_status === "overdue";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30",
        isDone && "opacity-50"
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle({ id: task.id, done: !isDone }); }}
        className="shrink-0 transition-all active:scale-90"
      >
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : isOverdue || slaOverdue ? (
          <AlertCircle className="h-5 w-5 text-rose-500" />
        ) : slaWarning ? (
          <Clock className="h-5 w-5 text-amber-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/30 hover:text-indigo-500/60" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[11px] font-bold truncate",
          isDone ? "line-through text-muted-foreground" : "text-foreground"
        )}>
          {task.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          {task.assignee?.full_name && (
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {task.assignee.full_name}
            </span>
          )}
          {task.deadline_at && (
            <span className={cn(
              "text-[9px] flex items-center gap-1",
              isOverdue ? "text-rose-500 font-bold" : "text-muted-foreground"
            )}>
              <Clock className="h-2.5 w-2.5" />
              {format(parseISO(task.deadline_at), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          )}
        </div>
      </div>

      {!isDone && (slaOverdue || slaWarning) && (
        <Badge
          variant="outline"
          className={cn(
            "text-[8px] font-black uppercase px-1.5 py-0 h-4 shrink-0",
            slaOverdue
              ? "border-rose-500/30 text-rose-500 bg-rose-500/5"
              : "border-amber-500/30 text-amber-500 bg-amber-500/5"
          )}
        >
          {slaOverdue ? "SLA" : "Atenção"}
        </Badge>
      )}

      {isDone && task.completed_at && (
        <span className="text-[8px] text-muted-foreground shrink-0">
          {format(parseISO(task.completed_at), "dd/MM", { locale: ptBR })}
        </span>
      )}
    </div>
  );
}
