import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type MarketingDemand } from "@/pages/marketing/MarketingDemands";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, AlertTriangle, Calendar, CheckCircle, Image, Video, Paperclip, Send, Flame, Minus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_COLUMNS = [
  { key: "requested", label: "Solicitado", color: "bg-yellow-500/10 border-yellow-500/20" },
  { key: "in_progress", label: "Em Produção", color: "bg-blue-500/10 border-blue-500/20" },
  { key: "in_review", label: "Em Revisão", color: "bg-purple-500/10 border-purple-500/20" },
  { key: "done", label: "Aprovado", color: "bg-green-500/10 border-green-500/20" },
] as const;

const STAGE_LABELS: Record<string, string> = {
  copy: "Copy",
  designer: "Designer",
  editor: "Editor de Vídeo",
  web_designer: "Web Designer",
  traffic_manager: "Gestor de Tráfego",
  done: "Concluído",
};

const DELIVERABLE_LABELS: Record<string, string> = {
  copy: "Texto da Copy",
  designer: "Arquivo do Designer",
  editor: "Arquivo do Editor",
  web_designer: "Arquivo do Web Designer",
  traffic_manager: "Link/Arquivo do Gestor",
};

// Todas as etapas podem enviar pra qualquer outra OU concluir
const NEXT_STAGES: Record<string, { key: string; label: string }[]> = {
  copy: [
    { key: "designer", label: "Designer" },
    { key: "editor", label: "Editor de Vídeo" },
    { key: "web_designer", label: "Web Designer" },
    { key: "traffic_manager", label: "Gestor de Tráfego" },
    { key: "done", label: "Concluir" },
  ],
  designer: [
    { key: "editor", label: "Editor de Vídeo" },
    { key: "web_designer", label: "Web Designer" },
    { key: "traffic_manager", label: "Gestor de Tráfego" },
    { key: "done", label: "Concluir" },
  ],
  editor: [
    { key: "designer", label: "Designer" },
    { key: "web_designer", label: "Web Designer" },
    { key: "traffic_manager", label: "Gestor de Tráfego" },
    { key: "done", label: "Concluir" },
  ],
  web_designer: [
    { key: "designer", label: "Designer" },
    { key: "editor", label: "Editor de Vídeo" },
    { key: "traffic_manager", label: "Gestor de Tráfego" },
    { key: "done", label: "Concluir" },
  ],
  traffic_manager: [
    { key: "done", label: "Concluir" },
  ],
};

const PRIORITY_CONFIG = {
  low: { label: "Baixa", icon: Minus, color: "text-muted-foreground", bg: "" },
  normal: { label: "Normal", icon: AlertTriangle, color: "text-yellow-500", bg: "" },
  urgent: { label: "Urgente", icon: Flame, color: "text-red-500", bg: "border-red-500/30 bg-red-500/5" },
};

export type Props = {
  demands: MarketingDemand[];
  completedDemands?: MarketingDemand[];
  stageName: string;
  isDoneTab?: boolean;
  onStatusChange: (demand: MarketingDemand, newStatus: string) => void;
  onSendToStage: (demand: MarketingDemand, nextStage: string) => void;
  onSaveDeliverable?: (demand: MarketingDemand, stage: string, content: string) => void;
  onEditDemand?: (demand: MarketingDemand) => void;
  onDeleteDemand?: (demand: MarketingDemand) => void;
  isLoading: boolean;
};

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
  const Icon = config.icon;
  if (priority === "normal") return null;
  return (
    <Badge variant={priority === "urgent" ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0 gap-0.5">
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  );
}

function DemandCard({ demand, onClick, isCompleted = false }: { demand: MarketingDemand; onClick: () => void; isCompleted?: boolean }) {
  const isOverdue = !isCompleted && demand.deadline && isPast(new Date(demand.deadline + "T23:59:59")) && !isToday(new Date(demand.deadline));
  const hasDeliverable = Object.keys(demand.stage_deliverables || {}).length > 0;
  const priorityBg = !isCompleted && demand.priority === "urgent" ? "border-red-500/30 bg-red-500/5" : "";

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${isCompleted ? "opacity-60" : ""} ${isOverdue ? "border-red-500/50" : ""} ${priorityBg}`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm leading-tight">
            {isCompleted && <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />}
            {demand.title}
          </h4>
          <div className="flex items-center gap-1 shrink-0">
            {hasDeliverable && <Paperclip className="h-3 w-3 text-muted-foreground" />}
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5">
              {demand.type === "image" ? <Image className="h-3 w-3" /> : <Video className="h-3 w-3" />}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {demand.deadline && (
            <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
              {format(new Date(demand.deadline), "dd MMM", { locale: ptBR })}
            </div>
          )}
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>
          )}
          <PriorityBadge priority={demand.priority} />
        </div>
      </CardContent>
    </Card>
  );
}

function DemandDetailDialog({
  demand,
  open,
  onOpenChange,
  onStatusChange,
  onSendToStage,
  onSaveDeliverable,
  onEditDemand,
  onDeleteDemand,
  isCompleted,
}: {
  demand: MarketingDemand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (demand: MarketingDemand, newStatus: string) => void;
  onSendToStage: (demand: MarketingDemand, nextStage: string) => void;
  onSaveDeliverable?: (demand: MarketingDemand, stage: string, content: string) => void;
  onEditDemand?: (demand: MarketingDemand) => void;
  onDeleteDemand?: (demand: MarketingDemand) => void;
  isCompleted: boolean;
}) {
  const [deliverableText, setDeliverableText] = useState("");
  const [editingDeliverable, setEditingDeliverable] = useState<string | null>(null);

  if (!demand) return null;

  const isOverdue = !isCompleted && demand.deadline && isPast(new Date(demand.deadline + "T23:59:59")) && !isToday(new Date(demand.deadline));

  // Status flow: requested → in_progress → in_review → done
  let nextStatus: string | null = null;
  let nextLabel: string | null = null;
  if (!isCompleted) {
    if (demand.current_status === "requested") { nextStatus = "in_progress"; nextLabel = "Iniciar Produção"; }
    else if (demand.current_status === "in_progress") { nextStatus = "in_review"; nextLabel = "Enviar pra Revisão"; }
    else if (demand.current_status === "in_review") { nextStatus = "done"; nextLabel = "Aprovar"; }
  }

  const sendOptions = !isCompleted && demand.current_status === "done" ? (NEXT_STAGES[demand.current_stage] || []) : [];
  const deliverables = demand.stage_deliverables || {};

  const allStages = [...(demand.completed_stages || [])];
  if (!allStages.includes(demand.current_stage) && demand.current_stage !== "done") {
    allStages.push(demand.current_stage);
  }

  const priorityConfig = PRIORITY_CONFIG[demand.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
  const PriorityIcon = priorityConfig.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditingDeliverable(null); setDeliverableText(""); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isCompleted && <CheckCircle className="h-4 w-4 text-green-500" />}
              {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
              {demand.title}
            </DialogTitle>
            <div className="flex items-center gap-1">
              {onEditDemand && !isCompleted && (
                <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => { onOpenChange(false); onEditDemand(demand); }}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
              {typeof onDeleteDemand === "function" && (
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => { if (window.confirm("Excluir esta demanda?")) { onDeleteDemand!(demand); onOpenChange(false); } }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              {demand.type === "image" ? <Image className="h-3 w-3" /> : <Video className="h-3 w-3" />}
              {demand.type === "image" ? "Imagem" : "Vídeo"}
            </Badge>

            <Badge variant="secondary">
              {STAGE_LABELS[demand.current_stage] || demand.current_stage}
            </Badge>

            <Badge variant={demand.priority === "urgent" ? "destructive" : "outline"} className="gap-1">
              <PriorityIcon className="h-3 w-3" />
              {priorityConfig.label}
            </Badge>

            {demand.deadline && (
              <div className={`flex items-center gap-1 text-sm ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(demand.deadline), "dd 'de' MMMM", { locale: ptBR })}
              </div>
            )}

            {isOverdue && <Badge variant="destructive">Atrasado</Badge>}
          </div>

          {demand.completed_stages?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">Concluído:</span>
              {demand.completed_stages.map((s) => (
                <Badge key={s} variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {STAGE_LABELS[s] || s}
                </Badge>
              ))}
            </div>
          )}

          {demand.description ? (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Briefing</p>
              <p className="text-sm whitespace-pre-wrap">{demand.description}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">Sem descrição</p>
            </div>
          )}

          {allStages.map((stage) => {
            const content = deliverables[stage];
            const label = DELIVERABLE_LABELS[stage] || `Entrega: ${STAGE_LABELS[stage]}`;
            const isEditing = editingDeliverable === stage;
            const canEdit = !isCompleted && (stage === demand.current_stage || demand.completed_stages?.includes(stage));

            if (!content && !canEdit) return null;

            return (
              <div key={stage} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    {label}
                  </Label>
                  {content && !isEditing && canEdit && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditingDeliverable(stage); setDeliverableText(content); }}>
                      Editar
                    </Button>
                  )}
                </div>

                {content && !isEditing ? (
                  <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-3">{content}</div>
                ) : canEdit ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Cole aqui o texto, link do arquivo, URL do drive..."
                      value={isEditing ? deliverableText : ""}
                      onChange={(e) => setDeliverableText(e.target.value)}
                      rows={3}
                      onFocus={() => { if (!isEditing) { setEditingDeliverable(stage); setDeliverableText(content || ""); } }}
                    />
                    {isEditing && (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingDeliverable(null); setDeliverableText(""); }}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={!deliverableText.trim()}
                          onClick={() => {
                            onSaveDeliverable?.(demand, stage, deliverableText.trim());
                            setEditingDeliverable(null);
                            setDeliverableText("");
                          }}
                        >
                          <Send className="h-3 w-3" />
                          Salvar
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="flex items-center justify-end gap-2 pt-2">
            {nextStatus && !isCompleted && (
              <Button
                variant={nextStatus === "done" ? "default" : "outline"}
                onClick={() => {
                  onStatusChange(demand, nextStatus!);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                {nextLabel}
              </Button>
            )}

            {sendOptions.map((opt) => (
              <Button
                key={opt.key}
                onClick={() => {
                  onSendToStage(demand, opt.key);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                Enviar para {opt.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MarketingDemandKanban({ demands, completedDemands = [], stageName, isDoneTab = false, onStatusChange, onSendToStage, onSaveDeliverable, onEditDemand, onDeleteDemand, isLoading }: Props) {
  const [selectedDemand, setSelectedDemand] = useState<MarketingDemand | null>(null);
  const [selectedIsCompleted, setSelectedIsCompleted] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((col) => (
          <div key={col.key} className="space-y-3">
            <div className="h-8 bg-muted rounded animate-pulse" />
            <div className="h-24 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // Aba "Concluídos" mostra lista simples
  if (isDoneTab) {
    const doneDemands = demands.filter((d) => d.current_stage === "done");
    return (
      <>
        <div className="space-y-2">
          {doneDemands.length === 0 ? (
            <div className="flex items-center justify-center h-32 border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">Nenhuma demanda concluída</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {doneDemands.map((demand) => (
                <DemandCard
                  key={demand.id}
                  demand={demand}
                  onClick={() => { setSelectedDemand(demand); setSelectedIsCompleted(true); }}
                  isCompleted
                />
              ))}
            </div>
          )}
        </div>
        <DemandDetailDialog
          demand={selectedDemand}
          open={!!selectedDemand}
          onOpenChange={(open) => { if (!open) setSelectedDemand(null); }}
          onStatusChange={onStatusChange}
          onSendToStage={onSendToStage}
          onSaveDeliverable={onSaveDeliverable}
          onEditDemand={onEditDemand}
          onDeleteDemand={onDeleteDemand}
          isCompleted={true}
        />
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const columnDemands = demands.filter((d) => d.current_status === col.key);
          const allDone = col.key === "done"
            ? [...columnDemands, ...completedDemands]
            : columnDemands;
          const totalCount = allDone.length;
          return (
            <div key={col.key} className="space-y-3">
              <div className={`rounded-lg border p-3 ${col.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{col.label}</h3>
                  <span className="text-xs text-muted-foreground">{totalCount}</span>
                </div>
              </div>

              <div className="space-y-2 min-h-[100px]">
                {totalCount === 0 ? (
                  <div className="flex items-center justify-center h-24 border border-dashed rounded-lg">
                    <p className="text-xs text-muted-foreground">Nenhuma demanda</p>
                  </div>
                ) : (
                  <>
                    {columnDemands.map((demand) => (
                      <DemandCard
                        key={demand.id}
                        demand={demand}
                        onClick={() => { setSelectedDemand(demand); setSelectedIsCompleted(false); }}
                      />
                    ))}
                    {col.key === "done" && completedDemands.map((demand) => (
                      <DemandCard
                        key={`completed-${demand.id}`}
                        demand={demand}
                        onClick={() => { setSelectedDemand(demand); setSelectedIsCompleted(true); }}
                        isCompleted
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DemandDetailDialog
        demand={selectedDemand}
        open={!!selectedDemand}
        onOpenChange={(open) => { if (!open) setSelectedDemand(null); }}
        onStatusChange={onStatusChange}
        onSendToStage={onSendToStage}
        onSaveDeliverable={onSaveDeliverable}
        onEditDemand={onEditDemand}
        onDeleteDemand={onDeleteDemand}
        isCompleted={selectedIsCompleted}
      />
    </>
  );
}
