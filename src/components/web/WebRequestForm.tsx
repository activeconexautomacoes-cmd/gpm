import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, Plus, X, Upload } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCreateWebRequest } from "@/hooks/useWeb";
import type { WebRequestType } from "@/types/web";
import { WEB_TYPE_CONFIG } from "@/types/web";

const schema = z.object({
  title: z.string().min(1, "Obrigatório"),
  description: z.string().min(1, "Obrigatório"),
  site_url: z.string().url("URL inválida").optional().or(z.literal("")),
  gestor_suggestion: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function WebRequestForm() {
  const navigate = useNavigate();
  const createRequest = useCreateWebRequest();
  const [requestType, setRequestType] = useState<WebRequestType>("outro");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([""]);
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [priority, setPriority] = useState<"normal" | "urgente">("normal");
  const [files, setFiles] = useState<File[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const addRefUrl = () => setReferenceUrls([...referenceUrls, ""]);
  const removeRefUrl = (i: number) => setReferenceUrls(referenceUrls.filter((_, idx) => idx !== i));
  const updateRefUrl = (i: number, v: string) => {
    const copy = [...referenceUrls];
    copy[i] = v;
    setReferenceUrls(copy);
  };

  const handleFiles = (fileList: FileList) => {
    setFiles((prev) => [...prev, ...Array.from(fileList)]);
  };

  const onSubmit = async (data: FormData) => {
    const result = await createRequest.mutateAsync({
      title: data.title,
      description: data.description,
      request_type: requestType,
      site_url: data.site_url || undefined,
      reference_urls: referenceUrls.filter(Boolean),
      gestor_suggestion: data.gestor_suggestion || undefined,
      deadline: deadline?.toISOString().split("T")[0],
      priority,
      files: files.length > 0 ? files : undefined,
    });
    navigate(`/dashboard/web/${result.id}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* Título */}
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input id="title" placeholder="Ex: Criar landing page Black Friday" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="description">Descrição Detalhada *</Label>
        <Textarea id="description" placeholder="Descreva em detalhes o que precisa ser feito, incluindo funcionalidades, comportamentos esperados, textos, etc." {...register("description")} rows={6} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      {/* URL do Site */}
      <div className="space-y-2">
        <Label htmlFor="site_url">URL do Site (opcional)</Label>
        <Input id="site_url" placeholder="https://www.exemplo.com.br" {...register("site_url")} />
      </div>

      {/* URLs de Referência */}
      <div className="space-y-2">
        <Label>URLs de Referência (opcional)</Label>
        <div className="space-y-2">
          {referenceUrls.map((url, i) => (
            <div key={i} className="flex gap-2">
              <Input value={url} onChange={(e) => updateRefUrl(i, e.target.value)} placeholder="https://referencia.com" />
              {referenceUrls.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRefUrl(i)} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRefUrl}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar referência
          </Button>
        </div>
      </div>

      {/* Anexos */}
      <div className="space-y-2">
        <Label>Anexos (opcional)</Label>
        <div
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = ".png,.jpg,.jpeg,.pdf,.doc,.docx";
            input.onchange = (e) => { const f = (e.target as HTMLInputElement).files; if (f) handleFiles(f); };
            input.click();
          }}
        >
          <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Clique para selecionar arquivos</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, PDF, DOC, DOCX</p>
        </div>
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded border bg-muted/30">
                <span className="truncate">{f.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prazo e Prioridade */}
      <div className="flex gap-4 items-end">
        <div className="space-y-2 flex-1">
          <Label>Prazo (opcional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deadline ? format(deadline, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={deadline} onSelect={setDeadline} disabled={(d) => d < new Date()} locale={ptBR} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <div className="flex items-center gap-2 h-10">
            <span className="text-sm text-muted-foreground">Normal</span>
            <Switch checked={priority === "urgente"} onCheckedChange={(c) => setPriority(c ? "urgente" : "normal")} />
            <span className={`text-sm ${priority === "urgente" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>Urgente</span>
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={createRequest.isPending}>
        {createRequest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Enviar Demanda Web
      </Button>
    </form>
  );
}
