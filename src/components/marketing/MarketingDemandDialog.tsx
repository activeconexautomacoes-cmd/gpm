import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { type MarketingDemand } from "@/pages/marketing/MarketingDemands";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Image, Video, AlertTriangle, Minus, Flame } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDemand?: MarketingDemand | null;
};

export function MarketingDemandDialog({ open, onOpenChange, editDemand }: Props) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"image" | "video">("image");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "urgent">("normal");

  const isEditing = !!editDemand;

  useEffect(() => {
    if (editDemand) {
      setTitle(editDemand.title);
      setType(editDemand.type);
      setDescription(editDemand.description || "");
      setDeadline(editDemand.deadline || "");
      setPriority(editDemand.priority || "normal");
    } else {
      resetForm();
    }
  }, [editDemand, open]);

  const createDemand = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await supabase.from("marketing_demands" as any).insert([{
        workspace_id: currentWorkspace!.id,
        title,
        type,
        description: description || null,
        deadline: deadline || null,
        priority,
        current_stage: "copy",
        current_status: "requested",
        created_by: user?.id,
      }] as any);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-demands"] });
      toast({ title: "Demanda criada", description: "Enviada para a etapa de Copy." });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err?.message || err?.details || JSON.stringify(err);
      toast({ title: "Erro ao criar demanda", description: msg, variant: "destructive" });
    },
  });

  const updateDemand = useMutation({
    mutationFn: async () => {
      const res = await (supabase
        .from("marketing_demands" as any)
        .update({
          title,
          type,
          description: description || null,
          deadline: deadline || null,
          priority,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", editDemand!.id) as any);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-demands"] });
      toast({ title: "Demanda atualizada" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err?.message || err?.details || JSON.stringify(err);
      toast({ title: "Erro ao atualizar", description: msg, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setType("image");
    setDescription("");
    setDeadline("");
    setPriority("normal");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (isEditing) {
      updateDemand.mutate();
    } else {
      createDemand.mutate();
    }
  };

  const isPending = createDemand.isPending || updateDemand.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Demanda" : "Nova Demanda de Marketing"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Ex: Campanha Black Friday"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "image" | "video")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Imagem
                    </div>
                  </SelectItem>
                  <SelectItem value="video">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Vídeo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "normal" | "urgent")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-muted-foreground" />
                      Baixa
                    </div>
                  </SelectItem>
                  <SelectItem value="normal">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Normal
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-red-500" />
                      Urgente
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição / Briefing</Label>
            <Textarea
              id="description"
              placeholder="Descreva o que precisa ser produzido..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Prazo</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar Demanda"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
