import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface MemberDialogProps {
  member: any;
  onClose: () => void;
  roles: { id: string; name: string; color: string | null }[];
}

export function MemberDialog({ member, onClose, roles }: MemberDialogProps) {
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Initialize with role_id if available, otherwise find role by enum name, otherwise empty (shouldn't happen for valid members)
  const initialRoleId = member.role_id || roles.find(r => r.name.toLowerCase() === member.role?.toLowerCase())?.id || roles[0]?.id;
  const [selectedRoleId, setSelectedRoleId] = useState(initialRoleId);

  const updateRoleMutation = useMutation({
    mutationFn: async (newRoleId: string) => {
      const { error } = await supabase
        .from("workspace_members")
        .update({
          role_id: newRoleId
        } as any)
        .eq("id", member.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      toast.success("Função atualizada com sucesso!");
      onClose();
    },
    onError: () => {
      toast.error("Erro ao atualizar função");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", member.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      toast.success("Membro removido com sucesso!");
      onClose();
    },
    onError: () => {
      toast.error("Erro ao remover membro");
    },
  });

  return (
    <>
      <Dialog open={!!member} onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Membro</DialogTitle>
            <DialogDescription>
              {member.profiles?.full_name} ({member.profiles?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Função</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={member.role === "owner" || member.roles?.name === "Owner"}
              >
                Remover do Workspace
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => updateRoleMutation.mutate(selectedRoleId)}
                  disabled={
                    selectedRoleId === member.role_id ||
                    updateRoleMutation.isPending ||
                    (member.role === "owner" && selectedRoleId === member.role_id) // simplified check
                  }
                >
                  {updateRoleMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {member.profiles?.full_name} do workspace?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMemberMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
