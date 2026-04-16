
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ContractDialog } from "../contracts/ContractDialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Search, Briefcase, Users, User, ChevronDown, ChevronRight, Settings } from "lucide-react";

export function ClientPortfolio() {
    const { currentWorkspace, user, can } = useWorkspace();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [squadFilter, setSquadFilter] = useState("all");
    const [managerFilter, setManagerFilter] = useState("all");

    // Sort State
    const [sortField, setSortField] = useState<string>("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    // UI State for collapse
    const [collapsedSquads, setCollapsedSquads] = useState<Record<string, boolean>>({});
    const [collapsedManagers, setCollapsedManagers] = useState<Record<string, boolean>>({});

    // UI State for Contract Dialog
    const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
    const [selectedContract, setSelectedContract] = useState<any>(null);

    const isTrafficManager = currentWorkspace?.role_details?.name === "Gestor de Tráfego" || currentWorkspace?.role === "member";
    const isAdminOrOwner = currentWorkspace?.role === 'owner' ||
        currentWorkspace?.role_details?.name === "Dono" ||
        currentWorkspace?.role_details?.name === "Admin";

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const updatePerformanceMutation = useMutation({
        mutationFn: async ({ contractId, rating }: { contractId: string, rating: string }) => {
            const { error } = await (supabase as any)
                .from("contracts")
                .update({ performance_rating: rating })
                .eq("id", contractId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contracts-portfolio"] });
            toast({
                title: "Resultado atualizado!",
                description: "O status do cliente foi alterado com sucesso.",
            });
        },
        onError: (err: any) => {
            toast({
                title: "Erro ao atualizar",
                description: err.message || "Não foi possível atualizar o resultado.",
                variant: "destructive"
            });
        }
    });

    const toggleSquad = (id: string) => {
        setCollapsedSquads(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleManager = (id: string) => {
        setCollapsedManagers(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleEditContract = (contract: any) => {
        setSelectedContract(contract);
        setIsContractDialogOpen(true);
    };

    // Fetch Squads
    const { data: squads } = useQuery({
        queryKey: ["squads", currentWorkspace?.id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("squads")
                .select("*")
                .eq("workspace_id", currentWorkspace?.id);
            if (error) throw error;
            return data as any[];
        },
        enabled: !!currentWorkspace?.id
    });

    // Fetch Managers (all profiles in workspace)
    const { data: managers } = useQuery({
        queryKey: ["workspace-managers", currentWorkspace?.id],
        queryFn: async () => {
            const { data: members } = await supabase
                .from("workspace_members")
                .select("user_id")
                .eq("workspace_id", currentWorkspace?.id);

            if (!members || members.length === 0) return [];

            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .in("id", members.map(m => m.user_id));
            if (error) throw error;
            return data as any[];
        },
        enabled: !!currentWorkspace?.id
    });

    // Fetch Squad Members to know which user belongs to which squad
    const { data: squadMembers } = useQuery({
        queryKey: ["squad-members-all", currentWorkspace?.id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("squad_members")
                .select(`
                    *,
                    squads (id, name, color)
                `);
            if (error) throw error;
            return data as any[];
        },
        enabled: !!currentWorkspace?.id
    });

    // Create a map of user_id -> squad
    const userSquadMap = useMemo(() => {
        const map: Record<string, any> = {};
        if (squadMembers) {
            squadMembers.forEach((sm: any) => {
                map[sm.user_id] = sm.squads;
            });
        }
        return map;
    }, [squadMembers]);

    // Fetch Contracts with active status
    const { data: contracts, isLoading } = useQuery({
        queryKey: ["contracts-portfolio", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];

            const { data, error } = await (supabase as any)
                .from("contracts")
                .select(`
                    *,
                    clients (id, name, email),
                    squads (id, name, color),
                    account_manager:account_manager_id (id, full_name, avatar_url)
                `)
                .eq("workspace_id", currentWorkspace.id)
                .eq("status", "active");

            if (error) throw error;
            return data as any[];
        },
        enabled: !!currentWorkspace?.id
    });

    const filteredContracts = useMemo(() => {
        if (!contracts) return [];
        let result = contracts.filter((contract: any) => {
            const matchesSearch =
                contract.name.toLowerCase().includes(search.toLowerCase()) ||
                (contract.clients?.name || "").toLowerCase().includes(search.toLowerCase());

            const managerSquad = contract.account_manager_id ? userSquadMap[contract.account_manager_id] : null;
            const effectiveSquadId = contract.squad_id || managerSquad?.id || "unassigned";

            const matchesSquad = squadFilter === "all" || effectiveSquadId === squadFilter;
            const matchesManager = managerFilter === "all" || contract.account_manager_id === managerFilter;
            return matchesSearch && matchesSquad && matchesManager;
        });

        // Apply Sorting
        result.sort((a: any, b: any) => {
            let valA, valB;
            if (sortField === "name") {
                valA = a.name;
                valB = b.name;
            } else if (sortField === "date") {
                valA = a.start_date || "";
                valB = b.start_date || "";
            } else if (sortField === "rating") {
                const ratingOrder: Record<string, number> = { good: 3, medium: 2, bad: 1 };
                valA = ratingOrder[a.performance_rating || "medium"];
                valB = ratingOrder[b.performance_rating || "medium"];
            } else {
                return 0;
            }

            if (valA < valB) return sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [contracts, search, squadFilter, managerFilter, sortField, sortDirection]);

    const groupedData = useMemo(() => {
        if (!filteredContracts) return [];

        const groups: any[] = [];

        filteredContracts.forEach((contract: any) => {
            // Priority: Contract's explicit Squad > Account Manager's Squad > Unassigned
            const managerSquad = contract.account_manager_id ? userSquadMap[contract.account_manager_id] : null;

            const squadId = contract.squad_id || managerSquad?.id || "unassigned";
            const squadName = contract.squads?.name || managerSquad?.name || "Sem Squad";
            const squadColor = contract.squads?.color || managerSquad?.color || "#94a3b8";

            let squadGroup = groups.find(g => g.id === squadId);
            if (!squadGroup) {
                squadGroup = {
                    id: squadId,
                    name: squadName,
                    color: squadColor,
                    managers: []
                };
                groups.push(squadGroup);
            }

            const managerId = contract.account_manager_id || "unassigned";
            const managerName = contract.account_manager?.full_name || "Sem Gestor";
            const managerAvatar = contract.account_manager?.avatar_url;

            let managerGroup = squadGroup.managers.find((m: any) => m.id === managerId);
            if (!managerGroup) {
                managerGroup = {
                    id: managerId,
                    name: managerName,
                    avatar: managerAvatar,
                    contracts: []
                };
                squadGroup.managers.push(managerGroup);
            }

            managerGroup.contracts.push(contract);
        });

        // Sort groups: unassigned at the end
        return groups.sort((a, b) => {
            if (a.id === "unassigned") return 1;
            if (b.id === "unassigned") return -1;
            return a.name.localeCompare(b.name);
        });
    }, [filteredContracts]);

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando carteira operacional...</div>;

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar loja ou cliente..."
                        className="pl-8 bg-background/50 backdrop-blur-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={squadFilter} onValueChange={setSquadFilter}>
                        <SelectTrigger className="w-[180px] bg-background/50 backdrop-blur-sm">
                            <SelectValue placeholder="Squad" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Squads</SelectItem>
                            {squads?.map((squad: any) => (
                                <SelectItem key={squad.id} value={squad.id}>{squad.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={managerFilter} onValueChange={setManagerFilter}>
                        <SelectTrigger className="w-[180px] bg-background/50 backdrop-blur-sm">
                            <SelectValue placeholder="Gestor" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Gestores</SelectItem>
                            {managers?.map((manager: any) => (
                                <SelectItem key={manager.id} value={manager.id}>{manager.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-8">
                {groupedData.length === 0 ? (
                    <div className="rounded-md border bg-card p-12 text-center text-muted-foreground">
                        Nenhuma loja com contrato ativo encontrada.
                    </div>
                ) : (
                    groupedData.map((squadGroup: any) => {
                        const isSquadCollapsed = collapsedSquads[squadGroup.id];
                        const totalContracts = squadGroup.managers.reduce((acc: number, m: any) => acc + m.contracts.length, 0);

                        return (
                            <div key={squadGroup.id} className="space-y-4">
                                <div
                                    className="flex items-center gap-3 px-1 cursor-pointer group select-none"
                                    onClick={() => toggleSquad(squadGroup.id)}
                                >
                                    <div
                                        className="h-8 w-1.5 rounded-full transition-all group-hover:scale-y-110"
                                        style={{ backgroundColor: squadGroup.color }}
                                    />
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 group-hover:text-primary transition-colors">
                                            {squadGroup.name}
                                            <Badge variant="outline" className="ml-2 font-normal text-xs bg-background/50">
                                                {totalContracts} {totalContracts === 1 ? 'loja' : 'lojas'}
                                            </Badge>
                                        </h2>
                                        {isSquadCollapsed ? (
                                            <ChevronRight className="h-5 w-5 text-muted-foreground animate-in fade-in duration-300" />
                                        ) : (
                                            <ChevronDown className="h-5 w-5 text-muted-foreground animate-in fade-in duration-300" />
                                        )}
                                    </div>
                                </div>

                                {!isSquadCollapsed && (
                                    <div className="space-y-6 pl-4 border-l ml-3.5 border-dashed border-muted-foreground/30 animate-in slide-in-from-left-2 duration-300">
                                        {squadGroup.managers.map((managerGroup: any) => {
                                            const managerKey = `${squadGroup.id}-${managerGroup.id}`;
                                            const isManagerCollapsed = collapsedManagers[managerKey];

                                            return (
                                                <div key={managerGroup.id} className="space-y-3">
                                                    <div
                                                        className="flex items-center gap-2 py-1 cursor-pointer group/manager select-none"
                                                        onClick={() => toggleManager(managerKey)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-6 w-6 ring-2 ring-background ring-offset-2 ring-offset-muted-foreground/10">
                                                                <AvatarImage src={managerGroup.avatar} />
                                                                <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-sm font-semibold text-muted-foreground group-hover/manager:text-foreground transition-colors">
                                                                Gestor: {managerGroup.name}
                                                            </span>
                                                            <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal border-none bg-muted/50">
                                                                {managerGroup.contracts.length}
                                                            </Badge>
                                                        </div>
                                                        {isManagerCollapsed ? (
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover/manager:text-foreground transition-colors" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground/50 group-hover/manager:text-foreground transition-colors" />
                                                        )}
                                                    </div>

                                                    {!isManagerCollapsed && (
                                                        <div className="rounded-xl border bg-card/40 backdrop-blur-md overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <Table>
                                                                <TableHeader className="bg-muted/40">
                                                                    <TableRow className="hover:bg-transparent">
                                                                        <TableHead
                                                                            className="w-[30%] cursor-pointer hover:text-primary transition-colors"
                                                                            onClick={() => handleSort("name")}
                                                                        >
                                                                            <div className="flex items-center gap-1">
                                                                                Loja / Cliente
                                                                                <ArrowUpDown className="h-3 w-3" />
                                                                            </div>
                                                                        </TableHead>
                                                                        <TableHead
                                                                            className="cursor-pointer hover:text-primary transition-colors"
                                                                            onClick={() => handleSort("date")}
                                                                        >
                                                                            <div className="flex items-center gap-1">
                                                                                Data Início
                                                                                <ArrowUpDown className="h-3 w-3" />
                                                                            </div>
                                                                        </TableHead>
                                                                        <TableHead
                                                                            className="cursor-pointer hover:text-primary transition-colors"
                                                                            onClick={() => handleSort("rating")}
                                                                        >
                                                                            <div className="flex items-center gap-1">
                                                                                Resultado
                                                                                <ArrowUpDown className="h-3 w-3" />
                                                                            </div>
                                                                        </TableHead>
                                                                        <TableHead>Status</TableHead>
                                                                        <TableHead className="text-right">Ações</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {managerGroup.contracts.map((contract: any) => {
                                                                        const managerSquad = contract.account_manager_id ? userSquadMap[contract.account_manager_id] : null;
                                                                        const effectiveSquadId = contract.squad_id || managerSquad?.id;

                                                                        const isSquadLeader = squadMembers?.some(sm =>
                                                                            sm.user_id === user?.id &&
                                                                            sm.squad_id === effectiveSquadId &&
                                                                            sm.role === 'leader'
                                                                        );

                                                                        const canEditRating = isAdminOrOwner ||
                                                                            can('ops.manage') ||
                                                                            user?.id === contract.account_manager_id ||
                                                                            user?.id === contract.cs_id ||
                                                                            isSquadLeader;

                                                                        const canEditContract = isAdminOrOwner || can('ops.manage') || !isTrafficManager;

                                                                        return (
                                                                            <TableRow key={contract.id} className="hover:bg-muted/30 transition-colors group/row">
                                                                                <TableCell className="font-medium">
                                                                                    <div
                                                                                        className={cn(
                                                                                            "flex flex-col p-1 -m-1 rounded transition-colors group/name",
                                                                                            canEditContract && "cursor-pointer hover:bg-muted/50"
                                                                                        )}
                                                                                        onClick={() => canEditContract && handleEditContract(contract)}
                                                                                    >
                                                                                        <div className="flex items-center gap-1">
                                                                                            <span className={cn(
                                                                                                "font-bold text-primary inline-block",
                                                                                                canEditContract && "group-hover/name:underline decoration-2 underline-offset-4 pointer-events-none"
                                                                                            )}>
                                                                                                {contract.name}
                                                                                            </span>
                                                                                            {canEditContract && <Settings className="h-3 w-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />}
                                                                                        </div>
                                                                                        <span className="text-xs text-muted-foreground">{contract.clients?.name}</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <span className="text-sm">
                                                                                        {contract.start_date ? format(new Date(contract.start_date), "dd/MM/yyyy") : "-"}
                                                                                    </span>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {canEditRating ? (
                                                                                        <Select
                                                                                            value={contract.performance_rating || "medium"}
                                                                                            onValueChange={(val) => updatePerformanceMutation.mutate({ contractId: contract.id, rating: val })}
                                                                                        >
                                                                                            <SelectTrigger className={cn(
                                                                                                "h-8 w-[100px] text-xs font-semibold py-0",
                                                                                                contract.performance_rating === 'good' && "bg-green-500/10 text-green-600 border-green-200",
                                                                                                (contract.performance_rating === 'medium' || !contract.performance_rating) && "bg-yellow-500/10 text-yellow-600 border-yellow-200",
                                                                                                contract.performance_rating === 'bad' && "bg-red-500/10 text-red-600 border-red-200",
                                                                                            )}>
                                                                                                <SelectValue />
                                                                                            </SelectTrigger>
                                                                                            <SelectContent>
                                                                                                <SelectItem value="good">Bom</SelectItem>
                                                                                                <SelectItem value="medium">Médio</SelectItem>
                                                                                                <SelectItem value="bad">Ruim</SelectItem>
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                    ) : (
                                                                                        <Badge
                                                                                            variant="outline"
                                                                                            className={cn(
                                                                                                "text-[10px] uppercase font-bold px-2 py-0.5",
                                                                                                contract.performance_rating === 'good' && "bg-green-500/10 text-green-600 border-green-200",
                                                                                                (contract.performance_rating === 'medium' || !contract.performance_rating) && "bg-yellow-500/10 text-yellow-600 border-yellow-200",
                                                                                                contract.performance_rating === 'bad' && "bg-red-500/10 text-red-600 border-red-200",
                                                                                            )}
                                                                                        >
                                                                                            {contract.performance_rating === 'good' ? 'Bom' : contract.performance_rating === 'bad' ? 'Ruim' : 'Médio'}
                                                                                        </Badge>
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Ativo</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="hover:bg-primary hover:text-primary-foreground group-hover/row:shadow-md transition-all rounded-lg"
                                                                                        onClick={() => navigate(`/dashboard/clients/${contract.client_id}/operations?contract_id=${contract.id}`)}
                                                                                    >
                                                                                        <Briefcase className="mr-2 h-4 w-4" />
                                                                                        Salão de Guerra
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <ContractDialog
                open={isContractDialogOpen}
                onOpenChange={setIsContractDialogOpen}
                contract={selectedContract}
            />
        </div>
    );
}
