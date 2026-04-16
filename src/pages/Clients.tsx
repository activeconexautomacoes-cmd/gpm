import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Users, Briefcase, Upload, ExternalLink as ExternalLinkIcon, Link } from "lucide-react";
import { toast } from "sonner";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ImportClientsDialog } from "@/components/clients/ImportClientsDialog";
import { useNavigate } from "react-router-dom";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreHorizontal, LayoutGrid, List as ListIcon, Phone, Mail, FileText } from "lucide-react";

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  trade_name?: string | null;
  email: string | null;
  email_billing?: string | null;
  phone: string | null;
  mobile?: string | null;
  document: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  status: "active" | "inactive";
  notes: string | null;
  zip_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  profession?: string | null;
  activity_segment?: string | null;
  revenue_bracket?: string | null;
  source?: string | null;
  registration_date?: string | null;
  portal_token: string | null;
  created_at: string;
  updated_at: string;
}

export default function Clients() {
  const { currentWorkspace, can } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allData as Client[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente excluído com sucesso");
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir cliente: " + error.message);
    },
  });

  if (!can('clients.manage')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-sm">
            Você não tem permissão para gerenciar clientes.
          </p>
        </div>
      </div>
    );
  }

  // Function to get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const filteredClients = clients?.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.document?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedClient(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie seus clientes e contratos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar em Massa
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <div className="flex items-center gap-2 border bg-card p-1 rounded-md">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 w-8 p-0"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground">Carregando clientes...</p>
        </div>
      ) : filteredClients && filteredClients.length > 0 ? (
        viewMode === "list" ? (
          <div className="rounded-md border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} className="group">
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{client.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm text-muted-foreground">
                        {client.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {client.email}</span>}
                        {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {client.phone}</span>}
                        {!client.email && !client.phone && <span>-</span>}
                      </div>
                    </TableCell>
                    <TableCell>{client.document || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={client.status === "active" ? "default" : "secondary"}
                        className={client.status === "active" ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {client.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/clients/${client.id}/operations`)}>
                            <Briefcase className="mr-2 h-4 w-4" /> Operações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const url = `${window.location.origin}/portal/${client.portal_token}`;
                            window.open(url, '_blank');
                          }}>
                            <ExternalLinkIcon className="mr-2 h-4 w-4" /> Abrir Portal Público
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const url = `${window.location.origin}/portal/${client.portal_token}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link do portal copiado!");
                          }}>
                            <Link className="mr-2 h-4 w-4" /> Copiar Link do Portal
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(client)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(client)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <Card key={client.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base font-semibold">{client.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Badge variant="outline" className={client.status === "active" ? "text-green-600 border-green-200 bg-green-50" : ""}>
                          {client.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/dashboard/clients/${client.id}/operations`)}>
                        <Briefcase className="mr-2 h-4 w-4" /> Operações
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const url = `${window.location.origin}/portal/${client.portal_token}`;
                        window.open(url, '_blank');
                      }}>
                        <ExternalLinkIcon className="mr-2 h-4 w-4" /> Abrir Portal Público
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const url = `${window.location.origin}/portal/${client.portal_token}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link do portal copiado!");
                      }}>
                        <Link className="mr-2 h-4 w-4" /> Copiar Link do Portal
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEdit(client)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(client)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-2 mt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{client.email || "Sem email"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{client.phone || "Sem telefone"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{client.document || "Sem documento"}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" onClick={() => navigate(`/dashboard/clients/${client.id}/operations`)}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Área do Cliente
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-10 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">Nenhum cliente encontrado</p>
        </div>
      )}

      <ImportClientsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ["clients"] })}
      />

      <ClientDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        client={selectedClient}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{clientToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clientToDelete && deleteMutation.mutate(clientToDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
