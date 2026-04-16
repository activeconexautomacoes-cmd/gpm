import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Globe, Calendar, User, Loader2, CheckCircle, RotateCcw, ExternalLink, FileIcon, Download, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WebStatusBadge } from "@/components/web/WebStatusBadge";
import { WebTypeBadge } from "@/components/web/WebTypeBadge";
import { WebCommentChat } from "@/components/web/WebCommentChat";
import { useWebRequest, useUpdateWebRequest, useUpdateWebRequestStatus, useCreateWebComment, useWebFiles, useUploadWebFile } from "@/hooks/useWeb";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";

export default function WebDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useWorkspace();
  const { toast } = useToast();
  const { data: request, isLoading } = useWebRequest(id!);
  const updateRequest = useUpdateWebRequest();
  const updateStatus = useUpdateWebRequestStatus();
  const createComment = useCreateWebComment();
  const { data: files = [] } = useWebFiles(id!);
  const uploadFile = useUploadWebFile();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustComment, setAdjustComment] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", site_url: "", gestor_suggestion: "", deadline: "", priority: "normal" as "normal" | "urgente" });

  if (isLoading || !request) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const isGestor = request.gestor_id === user?.id;

  const handleApprove = () => {
    updateStatus.mutate({ id: request.id, status: "concluida" }, {
      onSuccess: () => { toast({ title: "Demanda concluída!" }); setShowApproveDialog(false); },
    });
  };

  const handleRequestAdjust = () => {
    if (!adjustComment.trim()) return;
    createComment.mutate({ request_id: request.id, content: adjustComment.trim() }, {
      onSuccess: () => {
        updateStatus.mutate({ id: request.id, status: "ajustando" });
        toast({ title: "Ajuste solicitado" });
        setShowAdjustDialog(false);
        setAdjustComment("");
      },
    });
  };

  const isImage = (name: string) => /\.(png|jpg|jpeg)$/i.test(name);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/web")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{request.title}</h1>
              <WebStatusBadge status={request.status} />
              <WebTypeBadge type={request.request_type} />
              {request.priority === "urgente" && <Badge variant="destructive">URGENTE</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Criada em {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            setEditForm({
              title: request.title,
              description: request.description,
              site_url: request.site_url || "",
              gestor_suggestion: (request as any).gestor_suggestion || "",
              deadline: request.deadline || "",
              priority: request.priority,
            });
            setShowEditDialog(true);
          }}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          {isGestor && request.status === "ajustando" && (
            <>
              <Button variant="outline" onClick={() => setShowAdjustDialog(true)}>
                <RotateCcw className="h-4 w-4 mr-2" /> Solicitar Ajuste
              </Button>
              <Button onClick={() => setShowApproveDialog(true)}>
                <CheckCircle className="h-4 w-4 mr-2" /> Aprovar e Concluir
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
        <div className="space-y-6">
          {/* Info */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {request.gestor && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div><p className="text-xs text-muted-foreground">Gestor</p><p className="font-medium">{request.gestor.full_name}</p></div>
                  </div>
                )}
                {request.site_url && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div><p className="text-xs text-muted-foreground">Site</p><a href={request.site_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm truncate block max-w-[200px]">{request.site_url.replace(/^https?:\/\//, "")}</a></div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-xs text-muted-foreground">Prazo</p><p className="font-medium">{request.deadline ? format(new Date(request.deadline), "dd/MM/yyyy", { locale: ptBR }) : "Sem prazo"}</p></div>
                </div>
              </div>

              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Descrição</p>
                <p className="text-sm whitespace-pre-wrap">{request.description}</p>
              </div>

              {request.reference_urls && request.reference_urls.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">URLs de Referência</p>
                    <div className="space-y-1">
                      {request.reference_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-blue-400 hover:underline">
                          <ExternalLink className="h-3 w-3" /> {url}
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(request as any).gestor_suggestion && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
                    <p className="text-xs font-semibold text-primary mb-1">Sugestão do Gestor</p>
                    <p className="text-sm whitespace-pre-wrap">{(request as any).gestor_suggestion}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Files */}
          <Card>
            <CardHeader><CardTitle className="text-base">Arquivos</CardTitle></CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors mb-4"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = ".png,.jpg,.jpeg,.pdf,.doc,.docx";
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files;
                    if (f) Array.from(f).forEach((file) => uploadFile.mutate({ requestId: request.id, file }));
                  };
                  input.click();
                }}
              >
                {uploadFile.isPending ? <Loader2 className="h-6 w-6 mx-auto mb-1 animate-spin text-primary" /> : <FileIcon className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />}
                <p className="text-sm text-muted-foreground">{uploadFile.isPending ? "Enviando..." : "Clique para enviar arquivos"}</p>
              </div>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhum arquivo</p>
              ) : (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                      {isImage(f.file_name) ? (
                        <div className="h-10 w-10 rounded border overflow-hidden shrink-0 bg-muted">
                          <img src={f.file_url} alt={f.file_name} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded border flex items-center justify-center shrink-0 bg-muted"><FileIcon className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{f.file_name}</p>
                        <p className="text-xs text-muted-foreground">{f.uploader?.full_name} · {format(new Date(f.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0" asChild>
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat */}
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)]">
          <Card className="h-full flex flex-col">
            <WebCommentChat requestId={request.id} />
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Aprovar e Concluir</AlertDialogTitle><AlertDialogDescription>Tem certeza? A demanda será marcada como concluída.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleApprove} disabled={updateStatus.isPending}>{updateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Aprovar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Solicitar Ajuste</AlertDialogTitle><AlertDialogDescription>Descreva o que precisa ser ajustado.</AlertDialogDescription></AlertDialogHeader>
          <Textarea value={adjustComment} onChange={(e) => setAdjustComment(e.target.value)} placeholder="Descreva os ajustes..." rows={4} />
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleRequestAdjust} disabled={!adjustComment.trim() || createComment.isPending}>{createComment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Solicitar Ajuste</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Demanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={5} />
            </div>
            <div className="space-y-2">
              <Label>URL do Site</Label>
              <Input value={editForm.site_url} onChange={(e) => setEditForm({ ...editForm, site_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Sugestão Direta</Label>
              <Textarea value={editForm.gestor_suggestion} onChange={(e) => setEditForm({ ...editForm, gestor_suggestion: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Prioridade:</Label>
              <span className="text-sm text-muted-foreground">Normal</span>
              <Switch checked={editForm.priority === "urgente"} onCheckedChange={(c) => setEditForm({ ...editForm, priority: c ? "urgente" : "normal" })} />
              <span className={`text-sm ${editForm.priority === "urgente" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>Urgente</span>
            </div>
            <Button className="w-full" disabled={updateRequest.isPending} onClick={() => {
              updateRequest.mutate({
                id: request.id,
                title: editForm.title,
                description: editForm.description,
                site_url: editForm.site_url || undefined,
                gestor_suggestion: editForm.gestor_suggestion || undefined,
                deadline: editForm.deadline || null,
                priority: editForm.priority,
              }, { onSuccess: () => setShowEditDialog(false) });
            }}>
              {updateRequest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
