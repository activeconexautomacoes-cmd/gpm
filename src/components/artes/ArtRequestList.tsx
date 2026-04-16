import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArtStatusBadge } from "./ArtStatusBadge";
import type { ArtRequest, ArtStatus } from "@/types/artes";

const PAGE_SIZE = 15;

interface ArtRequestListProps {
  requests: ArtRequest[];
}

export function ArtRequestList({ requests }: ArtRequestListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = [...requests];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.promotion.toLowerCase().includes(q) ||
          r.site_url.toLowerCase().includes(q) ||
          r.designer?.full_name?.toLowerCase().includes(q) ||
          r.gestor?.full_name?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "priority") {
        if (a.priority === "urgente" && b.priority !== "urgente") return -1;
        if (b.priority === "urgente" && a.priority !== "urgente") return 1;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [requests, search, statusFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por promoção, site, designer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="solicitada">Solicitada</SelectItem>
            <SelectItem value="realizando">Realizando</SelectItem>
            <SelectItem value="ajustando">Ajustando</SelectItem>
            <SelectItem value="aprovacao">Aprovação</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Mais recentes</SelectItem>
            <SelectItem value="priority">Prioridade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium">Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promoção</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Designer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((req) => (
                <TableRow
                  key={req.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/dashboard/artes/${req.id}`)}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {req.promotion}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {req.site_url.replace(/^https?:\/\//, "")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.designer?.full_name || "-"}
                  </TableCell>
                  <TableCell>
                    <ArtStatusBadge status={req.status} />
                  </TableCell>
                  <TableCell>
                    {req.priority === "urgente" ? (
                      <Badge variant="destructive" className="text-xs">Urgente</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Normal</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {req.deadline
                      ? format(new Date(req.deadline), "dd/MM/yy", { locale: ptBR })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(req.created_at), "dd/MM/yy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} solicitação(ões)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
