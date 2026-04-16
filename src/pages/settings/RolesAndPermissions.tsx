import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Plus, Edit2, Trash2, Check, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const categoryTranslations: Record<string, string> = {
    settings: 'Configurações',
    dashboard: 'Dashboard',
    reports: 'Relatórios',
    crm: 'CRM',
    registries: 'Cadastros',
    contracts: 'Contratos',
    financial: 'Financeiro',
    team: 'Equipe',
    operations: 'Operações',
    tasks: 'Tarefas',
    metrics: 'Métricas',
    quizzes: 'Quizzes',
    kb: 'Base de Conhecimento',
    sdr: 'SDR AI',
};

const actionTranslations: Record<string, string> = {
    view: 'Visualizar',
    edit: 'Editar',
    manage: 'Gerenciar',
    config: 'Configurar',
    financial: 'Financeiro',
    crm: 'CRM',
    export: 'Exportar',
    view_all: 'Visualizar Tudo',
};

interface Permission {
    id: string;
    slug: string;
    description: string;
    category: string;
}

interface Role {
    id: string;
    name: string;
    description: string;
    color: string;
    permissions: { permission_id: string }[];
}

export default function RolesAndPermissions() {
    const { currentWorkspace, can, loading: workspaceLoading } = useWorkspace();
    const queryClient = useQueryClient();
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Temporary state for the form
    const [roleName, setRoleName] = useState("");
    const [roleDescription, setRoleDescription] = useState("");
    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

    // Fetch all available permissions
    const { data: allPermissions } = useQuery({
        queryKey: ["permissions"],
        queryFn: async () => {
            const { data, error } = await supabase.from("permissions").select("*").order("category");
            if (error) throw error;
            return data as Permission[];
        },
    });

    // Fetch roles for the workspace
    const { data: roles, isLoading } = useQuery({
        queryKey: ["roles", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("roles")
                .select(`
          *,
          permissions:role_permissions(permission_id)
        `)
                .eq("workspace_id", currentWorkspace.id)
                .order("created_at");

            if (error) throw error;
            return data.map(r => ({
                ...r,
                permissions: r.permissions || []
            })) as Role[];
        },
        enabled: !!currentWorkspace?.id,
    });

    const createRoleMutation = useMutation({
        mutationFn: async (data: { name: string; description: string; permissions: string[] }) => {
            if (!currentWorkspace?.id) throw new Error("No workspace");

            const { data: role, error } = await supabase
                .from("roles")
                .insert({
                    workspace_id: currentWorkspace.id,
                    name: data.name,
                    description: data.description,
                    color: "gray" // Default
                })
                .select()
                .single();

            if (error) throw error;

            if (data.permissions.length > 0) {
                const permissionInserts = data.permissions.map(pid => ({
                    role_id: role.id,
                    permission_id: pid
                }));

                const { error: permError } = await supabase.from("role_permissions").insert(permissionInserts);
                if (permError) throw permError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            setIsDialogOpen(false);
            toast.success("Perfil criado com sucesso");
        },
        onError: (error) => toast.error("Erro ao criar perfil: " + error.message)
    });

    const updateRoleMutation = useMutation({
        mutationFn: async (data: { id: string; name: string; description: string; permissions: string[] }) => {
            // Update Role details
            const { error: updateError } = await supabase
                .from("roles")
                .update({ name: data.name, description: data.description })
                .eq("id", data.id);

            if (updateError) throw updateError;

            // Sync permissions: Delete all and re-insert is easiest (though not efficient for huge sets, fine here)
            // Or better: diff them. For simplicity in MVP: Delete all -> Insert.

            const { error: deleteError } = await supabase
                .from("role_permissions")
                .delete()
                .eq("role_id", data.id);

            if (deleteError) throw deleteError;

            if (data.permissions.length > 0) {
                const permissionInserts = data.permissions.map(pid => ({
                    role_id: data.id,
                    permission_id: pid
                }));
                const { error: insertError } = await supabase.from("role_permissions").insert(permissionInserts);
                if (insertError) throw insertError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            // Also invalidate workspace context loading if I am editing my own role?
            // Ideally checking permissions...
            setIsDialogOpen(false);
            toast.success("Perfil atualizado com sucesso");
        },
        onError: (error) => toast.error("Erro ao atualizar: " + error.message)
    });

    const handleOpenCreate = () => {
        setEditMode(false);
        setRoleName("");
        setRoleDescription("");
        setSelectedPermissions(new Set());
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (role: Role) => {
        setEditMode(true);
        setSelectedRole(role);
        setRoleName(role.name);
        setRoleDescription(role.description || "");
        setSelectedPermissions(new Set((role.permissions || []).map(p => p.permission_id)));
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!roleName.trim()) {
            toast.error("Nome é obrigatório");
            return;
        }

        const permissionIds = Array.from(selectedPermissions);

        if (editMode && selectedRole) {
            updateRoleMutation.mutate({
                id: selectedRole.id,
                name: roleName,
                description: roleDescription,
                permissions: permissionIds
            });
        } else {
            createRoleMutation.mutate({
                name: roleName,
                description: roleDescription,
                permissions: permissionIds
            });
        }
    };

    const togglePermission = (id: string) => {
        const newSet = new Set(selectedPermissions);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedPermissions(newSet);
    };

    // Group permissions by category
    const permissionsByCategory = allPermissions?.reduce((acc, curr) => {
        const cat = curr.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(curr);
        return acc;
    }, {} as Record<string, Permission[]>) || {};

    if (workspaceLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Carregando permissões...</p>
            </div>
        );
    }

    if (!can('settings.view') && !can('settings.edit') && currentWorkspace?.role !== 'owner') {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">Você não tem permissão para visualizar esta página.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="h-8 w-8 text-primary" />
                        Perfis e Permissões
                    </h1>
                    <p className="text-muted-foreground">
                        Gerencie os níveis de acesso dos membros do workspace
                    </p>
                </div>
                <Button onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Perfil
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {roles?.map((role) => (
                    <Card key={role.id} className="relative group hover:shadow-lg transition-all border-l-4" style={{ borderLeftColor: role.color }}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-start">
                                <span>{role.name}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(role)}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardTitle>
                            <CardDescription>{role.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="text-xs">
                                    {role.permissions?.length ?? 0} Permissões
                                </Badge>
                                {role.name === 'Dono' && <Badge variant="secondary" className="text-xs">Sistema</Badge>}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editMode ? "Editar Perfil" : "Criar Novo Perfil"}</DialogTitle>
                        <DialogDescription>Defina o nome e as permissões de acesso deste perfil.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nome do Perfil</Label>
                                <Input
                                    id="name"
                                    value={roleName}
                                    onChange={(e) => setRoleName(e.target.value)}
                                    placeholder="Ex: Financeiro Júnior"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="desc">Descrição</Label>
                                <Input
                                    id="desc"
                                    value={roleDescription}
                                    onChange={(e) => setRoleDescription(e.target.value)}
                                    placeholder="Descrição das responsabilidades..."
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Permissões de Acesso</h3>

                            {Object.entries(permissionsByCategory).map(([category, perms]) => (
                                <div key={category} className="border rounded-lg p-4 space-y-3 shadow-sm bg-card/50">
                                    <h4 className="font-semibold text-sm uppercase tracking-wider text-primary/80">
                                        {categoryTranslations[category] || category}
                                    </h4>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {perms.map((perm) => {
                                            const action = perm.slug.split('.')[1];
                                            const translatedAction = actionTranslations[action] || action;

                                            return (
                                                <div key={perm.id} className="flex items-center justify-between p-2.5 rounded-md border bg-background/50 hover:bg-muted/50 transition-all group">
                                                    <div className="flex items-center space-x-3">
                                                        <Switch
                                                            id={perm.id}
                                                            checked={selectedPermissions.has(perm.id)}
                                                            onCheckedChange={() => togglePermission(perm.id)}
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <Label htmlFor={perm.id} className="font-medium cursor-pointer text-sm">
                                                                {translatedAction}
                                                            </Label>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help transition-colors" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="max-w-[250px] text-xs">
                                                                        <p className="font-semibold mb-1">{translatedAction} {categoryTranslations[category] || category}</p>
                                                                        <p>{perm.description}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={createRoleMutation.isPending || updateRoleMutation.isPending}>
                            {editMode ? "Salvar Alterações" : "Criar Perfil"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
