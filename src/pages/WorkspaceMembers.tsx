import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, UserPlus } from "lucide-react";
import { InviteMemberDialog } from "@/components/workspace/InviteMemberDialog";
import { InviteByUrlDialog } from "@/components/workspace/InviteByUrlDialog";
import { MemberDialog } from "@/components/workspace/MemberDialog";
import { Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";

interface WorkspaceMember {
  id: string;
  role: string;
  role_id: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  roles: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export default function WorkspaceMembers() {
  const { currentWorkspace, can } = useWorkspace();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteByUrlOpen, setInviteByUrlOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);

  // Fetch available roles for the workspace to pass to dialogs
  const { data: availableRoles } = useQuery({
    queryKey: ["roles", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await (supabase as any)
        .from("roles")
        .select("id, name, color")
        .eq("workspace_id", currentWorkspace.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["workspace-members", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("workspace_members")
        .select(`
          *,
          profiles (
            full_name,
            email,
            avatar_url
          ),
          roles (
            id,
            name,
            color
          )
        `)
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as WorkspaceMember[];
    },
    enabled: !!currentWorkspace?.id,
  });

  if (!can('team.manage') && currentWorkspace?.role !== 'owner') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">Você não tem permissão para gerenciar membros.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleBadgeVariant = (roleName: string | undefined | null, roleEnum: string) => {
    // Priority to dynamic role name if available, otherwise fallback
    if (roleName === "Dono") return "default"; // blue usually
    if (roleName === "Admin") return "secondary"; // blue

    // Fallback to enum
    switch (roleEnum) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getBadgeStyle = (roleColor: string | undefined) => {
    // If we have a custom color from DB, use it? Badge doesn't easily support arbitrary colors without inline styles or dynamic classes.
    // For now, rely on variant mapping or simple style.
    return {};
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Membros do Workspace</h1>
            <p className="text-muted-foreground">
              Gerencie os membros e permissões do workspace
            </p>
          </div>
        </div>
        {can('team.manage') && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setInviteByUrlOpen(true)}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Convidar por URL
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar Membro
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros Ativos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : members && members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Entrou em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.profiles?.full_name || "Nome não disponível"}
                    </TableCell>
                    <TableCell>{member.profiles?.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.roles?.name, member.role)}>
                        {member.roles?.name || member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(member.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {can('team.manage') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMember(member)}
                        >
                          Gerenciar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum membro encontrado
            </div>
          )}
        </CardContent>
      </Card>

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        roles={availableRoles || []}
      />

      <InviteByUrlDialog
        open={inviteByUrlOpen}
        onOpenChange={setInviteByUrlOpen}
        roles={availableRoles || []}
      />

      {selectedMember && (
        <MemberDialog
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          roles={availableRoles || []}
        />
      )}
    </div>
  );
}
