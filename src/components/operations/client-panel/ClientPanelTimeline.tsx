import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Loader2 } from "lucide-react";
import { useTimelineEvents, useDeleteTimelineEvent } from "@/hooks/useClientPanelTimeline";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ClientPanelEventCard } from "./ClientPanelEventCard";
import { ClientPanelEventForm } from "./ClientPanelEventForm";
import { EVENT_TYPE_CONFIG, type ClientPanelEventType } from "@/types/clientPanel";

interface ClientPanelTimelineProps {
  contractId: string;
}

export function ClientPanelTimeline({ contractId }: ClientPanelTimelineProps) {
  const { currentWorkspace } = useWorkspace();
  const { data: events, isLoading } = useTimelineEvents(contractId);
  const deleteEvent = useDeleteTimelineEvent(contractId);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const isAdminOrOwner =
    currentWorkspace?.role_details_list?.some(r => r.name === "Dono" || r.name === "Admin");

  const filteredEvents = (events || []).filter((event) => {
    const matchesSearch = event.content.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || event.event_type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nos eventos..."
            className="pl-8 bg-background/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px] bg-background/50">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Evento
        </Button>
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-lg border bg-card/40 p-12 text-center text-muted-foreground">
          {events?.length === 0
            ? "Nenhum evento registrado ainda. Clique em \"Novo Evento\" para comecar."
            : "Nenhum evento encontrado com os filtros atuais."}
        </div>
      ) : (
        <div className="space-y-0 pt-2">
          {filteredEvents.map((event) => (
            <ClientPanelEventCard
              key={event.id}
              event={event}
              canDelete={isAdminOrOwner}
              onDelete={(id) => deleteEvent.mutate(id)}
            />
          ))}
        </div>
      )}

      <ClientPanelEventForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contractId={contractId}
      />
    </div>
  );
}
