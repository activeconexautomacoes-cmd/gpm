import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Globe,
  Calendar,
  User,
  Loader2,
  CheckCircle,
  RotateCcw,
  Send,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArtStatusBadge } from "@/components/artes/ArtStatusBadge";
import { ArtBriefViewer } from "@/components/artes/ArtBriefViewer";
import { ArtCommentChat } from "@/components/artes/ArtCommentChat";
import { ArtFileUploader } from "@/components/artes/ArtFileUploader";
import {
  useArtRequest,
  useUpdateArtRequestStatus,
  useCreateArtComment,
  useRegenerateBrief,
} from "@/hooks/useArtes";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";

export default function ArtesDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can, user } = useWorkspace();
  const { toast } = useToast();
  const { data: request, isLoading } = useArtRequest(id!);
  const updateStatus = useUpdateArtRequestStatus();
  const createComment = useCreateArtComment();
  const regenerateBrief = useRegenerateBrief();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustComment, setAdjustComment] = useState("");

  if (isLoading || !request) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isGestor = request.gestor_id === user?.id || can("art.manage");
  const isDesigner = request.designer_id === user?.id;
  const canApprove = can("art.approve") && isGestor;
  const canUpload = can("art.upload") && isDesigner;

  const handleApprove = () => {
    updateStatus.mutate(
      { id: request.id, status: "concluida" },
      {
        onSuccess: () => {
          toast({ title: "Arte aprovada com sucesso!" });
          setShowApproveDialog(false);
        },
      }
    );
  };

  const handleRequestAdjust = () => {
    if (!adjustComment.trim()) return;
    createComment.mutate(
      { request_id: request.id, content: adjustComment.trim() },
      {
        onSuccess: () => {
          updateStatus.mutate({ id: request.id, status: "ajustando" });
          toast({ title: "Ajuste solicitado" });
          setShowAdjustDialog(false);
          setAdjustComment("");
        },
      }
    );
  };

  const handleSendToApproval = () => {
    updateStatus.mutate(
      { id: request.id, status: "aprovacao" },
      { onSuccess: () => toast({ title: "Enviado para aprovação" }) }
    );
  };

  const handleRegenerateBrief = () => {
    const formats = (request.formats || []).map((rf) => ({
      id: rf.format_id,
      name: rf.format?.name || "",
      width: rf.format?.width || 0,
      height: rf.format?.height || 0,
    }));
    regenerateBrief.mutate({
      requestId: request.id,
      siteUrl: request.site_url,
      promotion: request.promotion,
      formats,
      additionalText: request.additional_text || "",
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/artes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{request.promotion}</h1>
              <ArtStatusBadge status={request.status} />
              {request.priority === "urgente" && (
                <Badge variant="destructive">URGENTE</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Solicitação criada em{" "}
              {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {regenerateBrief.isPending ? (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Regenerando...
            </Button>
          ) : (
            isGestor && (
              <Button variant="outline" onClick={handleRegenerateBrief}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regerar Brief
              </Button>
            )
          )}

          {canUpload && (request.status === "realizando" || request.status === "ajustando") && (
            <Button onClick={handleSendToApproval}>
              <Send className="h-4 w-4 mr-2" />
              Enviar para Aprovação
            </Button>
          )}

          {canApprove && request.status === "aprovacao" && (
            <>
              <Button variant="outline" onClick={() => setShowAdjustDialog(true)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Solicitar Ajuste
              </Button>
              <Button onClick={() => setShowApproveDialog(true)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprovar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
        {/* Main Area */}
        <div className="space-y-6">
          {/* Info Card */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Site</p>
                    <a
                      href={request.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate block max-w-[200px]"
                    >
                      {request.site_url.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Designer</p>
                    <p className="font-medium">{request.designer?.full_name || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Gestor</p>
                    <p className="font-medium">{request.gestor?.full_name || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Prazo</p>
                    <p className="font-medium">
                      {request.deadline
                        ? format(new Date(request.deadline), "dd/MM/yyyy", { locale: ptBR })
                        : "Sem prazo"}
                    </p>
                  </div>
                </div>
              </div>
              {request.additional_text && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{request.additional_text}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Brief */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brief da IA</CardTitle>
            </CardHeader>
            <CardContent>
              <ArtBriefViewer formats={request.formats || []} />
            </CardContent>
          </Card>

          {/* Files */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquivos</CardTitle>
            </CardHeader>
            <CardContent>
              <ArtFileUploader requestId={request.id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Chat */}
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)]">
          <Card className="h-full flex flex-col">
            <ArtCommentChat requestId={request.id} />
          </Card>
        </div>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Arte</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja aprovar esta arte? Ela será marcada como concluída e
              salva no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={updateStatus.isPending}>
              {updateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjust Dialog */}
      <AlertDialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar Ajuste</AlertDialogTitle>
            <AlertDialogDescription>
              Descreva o que precisa ser ajustado. O designer receberá o comentário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={adjustComment}
            onChange={(e) => setAdjustComment(e.target.value)}
            placeholder="Descreva os ajustes necessários..."
            rows={4}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestAdjust}
              disabled={!adjustComment.trim() || createComment.isPending}
            >
              {createComment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Solicitar Ajuste
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
