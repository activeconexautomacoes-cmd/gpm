import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, GripVertical, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { ChecklistTemplate, ChecklistTemplateItem } from "@/types/operations";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ChecklistTemplate | null;
  stages: any[];
}

interface ItemForm {
  id?: string;
  title: string;
  description: string;
  default_assignee_role: "sdr" | "closer" | "custom";
  default_assignee_id: string;
  deadline_hours: number;
  deadline_unit: "hours" | "days";
  sla_hours: number;
  sla_unit: "hours" | "days";
  is_required: boolean;
  expanded: boolean;
  _tempId: string;
}

function SortableItem({
  item,
  index,
  members,
  onUpdate,
  onRemove,
}: {
  item: ItemForm;
  index: number;
  members: any[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item._tempId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const deadlineDisplay = item.deadline_unit === "days" ? item.deadline_hours / 24 : item.deadline_hours;
  const slaDisplay = item.sla_unit === "days" ? item.sla_hours / 24 : item.sla_hours;

  return (
    <div ref={setNodeRef} style={style} className="border rounded-xl bg-background p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <Input
            placeholder="Título da tarefa"
            value={item.title}
            onChange={(e) => onUpdate(index, "title", e.target.value)}
            className="font-semibold"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onUpdate(index, "expanded", !item.expanded)}
        >
          {item.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {item.expanded && (
        <div className="pl-7 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
            <Textarea
              placeholder="Detalhes da tarefa..."
              value={item.description}
              onChange={(e) => onUpdate(index, "description", e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Responsável padrão</Label>
              <Select
                value={item.default_assignee_role}
                onValueChange={(v) => onUpdate(index, "default_assignee_role", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sdr">SDR da oportunidade</SelectItem>
                  <SelectItem value="closer">Closer da oportunidade</SelectItem>
                  <SelectItem value="custom">Membro específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {item.default_assignee_role === "custom" && (
              <div>
                <Label className="text-xs text-muted-foreground">Membro</Label>
                <Select
                  value={item.default_assignee_id || "none"}
                  onValueChange={(v) => onUpdate(index, "default_assignee_id", v === "none" ? "" : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar...</SelectItem>
                    {members.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Prazo</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  value={deadlineDisplay}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    onUpdate(index, "deadline_hours", item.deadline_unit === "days" ? val * 24 : val);
                  }}
                  className="w-20"
                />
                <Select
                  value={item.deadline_unit}
                  onValueChange={(v: "hours" | "days") => {
                    const currentVal = item.deadline_unit === "days" ? item.deadline_hours / 24 : item.deadline_hours;
                    onUpdate(index, "deadline_unit", v);
                    onUpdate(index, "deadline_hours", v === "days" ? currentVal * 24 : currentVal);
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">horas</SelectItem>
                    <SelectItem value="days">dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">SLA</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  value={slaDisplay}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    onUpdate(index, "sla_hours", item.sla_unit === "days" ? val * 24 : val);
                  }}
                  className="w-20"
                />
                <Select
                  value={item.sla_unit}
                  onValueChange={(v: "hours" | "days") => {
                    const currentVal = item.sla_unit === "days" ? item.sla_hours / 24 : item.sla_hours;
                    onUpdate(index, "sla_unit", v);
                    onUpdate(index, "sla_hours", v === "days" ? currentVal * 24 : currentVal);
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">horas</SelectItem>
                    <SelectItem value="days">dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={item.is_required}
              onCheckedChange={(v) => onUpdate(index, "is_required", v)}
            />
            <Label className="text-xs">Obrigatório</Label>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChecklistTemplateDialog({ open, onOpenChange, template, stages }: TemplateDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [stageId, setStageId] = useState("");
  const [items, setItems] = useState<ItemForm[]>([]);

  const { data: members = [] } = useQuery({
    queryKey: ["members-list", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from("workspace_members")
        .select("profiles(id, full_name)")
        .eq("workspace_id", currentWorkspace.id);
      if (error) throw error;
      return (data as any[]).map((m) => m.profiles).filter(Boolean);
    },
    enabled: !!currentWorkspace?.id,
  });

  useEffect(() => {
    if (template) {
      setName(template.name || "");
      setStageId(template.stage_id || "");
      if (template.items && template.items.length > 0) {
        setItems(
          template.items
            .sort((a, b) => a.order_position - b.order_position)
            .map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description || "",
              default_assignee_role: item.default_assignee_role,
              default_assignee_id: item.default_assignee_id || "",
              deadline_hours: item.deadline_hours,
              deadline_unit: item.deadline_hours % 24 === 0 && item.deadline_hours >= 24 ? "days" as const : "hours" as const,
              sla_hours: item.sla_hours,
              sla_unit: item.sla_hours % 24 === 0 && item.sla_hours >= 24 ? "days" as const : "hours" as const,
              is_required: item.is_required,
              expanded: false,
              _tempId: item.id || crypto.randomUUID(),
            }))
        );
      } else {
        setItems([]);
      }
    } else {
      setName("");
      setStageId("");
      setItems([]);
    }
  }, [template, open]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i._tempId === active.id);
    const newIndex = items.findIndex((i) => i._tempId === over.id);
    setItems(arrayMove(items, oldIndex, newIndex));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        title: "",
        description: "",
        default_assignee_role: "closer",
        default_assignee_id: "",
        deadline_hours: 24,
        deadline_unit: "days",
        sla_hours: 48,
        sla_unit: "days",
        is_required: true,
        expanded: true,
        _tempId: crypto.randomUUID(),
      },
    ]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error("No workspace");
      if (!name.trim()) throw new Error("Nome obrigatório");
      if (!stageId) throw new Error("Estágio obrigatório");
      if (items.length === 0) throw new Error("Adicione pelo menos um item");
      if (items.some((i) => !i.title.trim())) throw new Error("Todos os itens precisam de título");

      const isEdit = template?.id && template.id.length > 10;

      if (isEdit) {
        // Update template
        const { error: tErr } = await (supabase as any)
          .from("checklist_templates")
          .update({ name, stage_id: stageId, updated_at: new Date().toISOString() })
          .eq("id", template!.id);
        if (tErr) throw tErr;

        // Delete old items and re-insert
        await (supabase as any)
          .from("checklist_template_items")
          .delete()
          .eq("template_id", template!.id);

        const itemsPayload = items.map((item, idx) => ({
          template_id: template!.id,
          title: item.title.trim(),
          description: item.description.trim() || null,
          order_position: idx,
          default_assignee_role: item.default_assignee_role,
          default_assignee_id: item.default_assignee_role === "custom" && item.default_assignee_id ? item.default_assignee_id : null,
          deadline_hours: item.deadline_hours,
          sla_hours: item.sla_hours,
          is_required: item.is_required,
        }));

        const { error: iErr } = await (supabase as any)
          .from("checklist_template_items")
          .insert(itemsPayload);
        if (iErr) throw iErr;
      } else {
        // Create template
        const { data: newTemplate, error: tErr } = await (supabase as any)
          .from("checklist_templates")
          .insert({
            workspace_id: currentWorkspace.id,
            name,
            stage_id: stageId,
          })
          .select()
          .single();
        if (tErr) throw tErr;

        const itemsPayload = items.map((item, idx) => ({
          template_id: newTemplate.id,
          title: item.title.trim(),
          description: item.description.trim() || null,
          order_position: idx,
          default_assignee_role: item.default_assignee_role,
          default_assignee_id: item.default_assignee_role === "custom" && item.default_assignee_id ? item.default_assignee_id : null,
          deadline_hours: item.deadline_hours,
          sla_hours: item.sla_hours,
          is_required: item.is_required,
        }));

        const { error: iErr } = await (supabase as any)
          .from("checklist_template_items")
          .insert(itemsPayload);
        if (iErr) throw iErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success(template?.id ? "Template atualizado" : "Template criado");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao salvar template");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.id ? "Editar Template" : "Novo Template de Checklist"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input
                placeholder="Ex: Checklist de Negociação"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estágio do Pipeline</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar estágio..." />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage: any) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color || "#6B7280" }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Itens da Checklist</Label>
              <span className="text-xs text-muted-foreground">{items.length} item(ns)</span>
            </div>

            {items.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i._tempId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <SortableItem
                        key={item._tempId}
                        item={item}
                        index={index}
                        members={members}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-xl border-dashed">
                Nenhum item adicionado. Clique em "Adicionar Item" para começar.
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Item
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
