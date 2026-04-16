import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface MemberWithPermissions {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role_name: string;
  permissions: string[];
}

export function ArtPermissionManager() {
  const { currentWorkspace } = useWorkspace();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["art-permission-members", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select(`
          user_id,
          profiles!workspace_members_user_id_fkey(id, full_name, email, avatar_url),
          roles(
            name,
            role_permissions(
              permissions(slug)
            )
          )
        `)
        .eq("workspace_id", currentWorkspace!.id);
      if (error) throw error;

      return (data || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name || m.profiles?.email || "Sem nome",
        email: m.profiles?.email || "",
        avatar_url: m.profiles?.avatar_url,
        role_name: m.roles?.name || "Sem role",
        permissions: m.roles?.role_permissions
          ?.map((rp: any) => rp.permissions?.slug)
          .filter((s: any) => s?.startsWith("art.")) || [],
      })) as MemberWithPermissions[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const artMembers = members.filter((m) => m.permissions.length > 0);
  const otherMembers = members.filter((m) => m.permissions.length === 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const permissionLabels: Record<string, string> = {
    "art.view": "Visualizar",
    "art.create": "Criar",
    "art.manage": "Gerenciar",
    "art.upload": "Upload",
    "art.approve": "Aprovar",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          As permissões de artes são atribuídas através dos perfis (roles) do workspace.
          Para alterar as permissões de um membro, vá em{" "}
          <a href="/dashboard/settings/roles" className="text-primary underline">
            Perfis e Permissões
          </a>{" "}
          e edite o role correspondente.
        </p>
      </div>

      {/* Members with art permissions */}
      <div>
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Membros com acesso ao módulo de Artes ({artMembers.length})
        </h3>
        {artMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum membro tem permissões de artes configuradas.
          </p>
        ) : (
          <div className="space-y-2">
            {artMembers.map((m) => (
              <MemberCard key={m.user_id} member={m} permissionLabels={permissionLabels} />
            ))}
          </div>
        )}
      </div>

      {/* Members without art permissions */}
      <div>
        <h3 className="font-semibold text-sm mb-3 text-muted-foreground">
          Outros membros ({otherMembers.length})
        </h3>
        <div className="space-y-2">
          {otherMembers.map((m) => (
            <MemberCard key={m.user_id} member={m} permissionLabels={permissionLabels} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  permissionLabels,
}: {
  member: MemberWithPermissions;
  permissionLabels: Record<string, string>;
}) {
  const initials = member.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={member.avatar_url || ""} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{member.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {member.role_name}
        </Badge>
        <div className="flex flex-wrap gap-1 shrink-0">
          {member.permissions.map((p) => (
            <Badge key={p} variant="secondary" className="text-[10px] px-1.5">
              {permissionLabels[p] || p}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
