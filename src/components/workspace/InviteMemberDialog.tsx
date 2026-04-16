import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: { id: string; name: string; color: string | null }[];
}

export function InviteMemberDialog({ open, onOpenChange, roles }: InviteMemberDialogProps) {
  const [loading, setLoading] = useState(false);
  const { currentWorkspace } = useWorkspace();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const roleId = formData.get("role") as string;

    // TODO: Implement invitation logic
    // For now we just log it as the original code was a placeholder
    console.log("Inviting", email, "with role ID", roleId);

    // This would typically involve:
    // 1. Creating an invitation record
    // 2. Sending an email to the invitee
    // 3. The invitee would accept and join the workspace

    toast.info("Funcionalidade de convite em desenvolvimento");
    setLoading(false);
    onOpenChange(false);
  };

  // Default to "Membro" or similar if found, else first role
  const defaultRole = roles.find(r => r.name === "Member" || r.name === "Membro" || r.name === "member")?.id || roles[0]?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar Membro</DialogTitle>
          <DialogDescription>
            Envie um convite para adicionar um novo membro ao workspace
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="email@exemplo.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Função</Label>
            <Select name="role" defaultValue={defaultRole}>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar Convite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
