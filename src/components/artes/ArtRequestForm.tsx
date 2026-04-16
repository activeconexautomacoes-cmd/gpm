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
import { CalendarIcon, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useArtFormats, useCreateArtRequest, useDesigners } from "@/hooks/useArtes";
import type { ArtPriority } from "@/types/artes";

const schema = z.object({
  site_url: z.string().url("URL inválida").min(1, "Obrigatório"),
  promotion: z.string().min(1, "Obrigatório"),
  designer_id: z.string().min(1, "Selecione um designer"),
  additional_text: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function ArtRequestForm() {
  const navigate = useNavigate();
  const { data: formats = [] } = useArtFormats();
  const { data: designers = [] } = useDesigners();
  const createRequest = useCreateArtRequest();

  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [priority, setPriority] = useState<ArtPriority>("normal");
  const [isGenerating, setIsGenerating] = useState(false);

  const activeFormats = formats.filter((f) => f.active);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { site_url: "", promotion: "", designer_id: "", additional_text: "" },
  });

  const toggleFormat = (id: string) => {
    setSelectedFormats((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const onSubmit = async (data: FormData) => {
    if (selectedFormats.length === 0) return;

    setIsGenerating(true);
    try {
      const result = await createRequest.mutateAsync({
        site_url: data.site_url,
        promotion: data.promotion,
        format_ids: selectedFormats,
        designer_id: data.designer_id,
        additional_text: data.additional_text,
        deadline: deadline?.toISOString().split("T")[0],
        priority,
      });
      navigate(`/dashboard/artes/${result.id}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="relative">
          <Sparkles className="h-16 w-16 text-primary animate-pulse" />
          <Loader2 className="h-8 w-8 animate-spin text-primary absolute -bottom-1 -right-1" />
        </div>
        <h3 className="text-xl font-semibold">A IA está analisando o site e gerando o brief...</h3>
        <p className="text-muted-foreground text-sm">Isso pode levar de 30 a 60 segundos</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* URL do Site */}
      <div className="space-y-2">
        <Label htmlFor="site_url">URL do Site *</Label>
        <Input
          id="site_url"
          placeholder="https://www.exemplo.com.br"
          {...register("site_url")}
        />
        {errors.site_url && (
          <p className="text-xs text-destructive">{errors.site_url.message}</p>
        )}
      </div>

      {/* Formatos */}
      <div className="space-y-2">
        <Label>Formatos *</Label>
        {selectedFormats.length === 0 && (
          <p className="text-xs text-destructive">Selecione pelo menos um formato</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {activeFormats.map((fmt) => {
            const isSelected = selectedFormats.includes(fmt.id);
            return (
              <div
                key={fmt.id}
                role="button"
                className={`cursor-pointer transition-all rounded-lg border p-3 flex items-center gap-2 ${
                  isSelected
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => toggleFormat(fmt.id)}
              >
                <div className={`h-4 w-4 rounded-sm border flex items-center justify-center shrink-0 ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                  {isSelected && <span className="text-primary-foreground text-xs">✓</span>}
                </div>
                <div>
                  <p className="text-sm font-medium">{fmt.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt.width}x{fmt.height}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Promoção */}
      <div className="space-y-2">
        <Label htmlFor="promotion">Oferta / Promoção *</Label>
        <Input
          id="promotion"
          placeholder="Ex: 20% OFF em todos os produtos"
          {...register("promotion")}
        />
        {errors.promotion && (
          <p className="text-xs text-destructive">{errors.promotion.message}</p>
        )}
      </div>

      {/* Designer */}
      <div className="space-y-2">
        <Label>Designer *</Label>
        <Select onValueChange={(v) => setValue("designer_id", v)} value={watch("designer_id")}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um designer" />
          </SelectTrigger>
          <SelectContent>
            {designers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.designer_id && (
          <p className="text-xs text-destructive">{errors.designer_id.message}</p>
        )}
      </div>

      {/* Texto adicional */}
      <div className="space-y-2">
        <Label htmlFor="additional_text">Texto Adicional (opcional)</Label>
        <Textarea
          id="additional_text"
          placeholder="Observações extras para a IA e o designer..."
          {...register("additional_text")}
          rows={3}
        />
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
              <Calendar
                mode="single"
                selected={deadline}
                onSelect={setDeadline}
                disabled={(date) => date < new Date()}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Prioridade</Label>
          <div className="flex items-center gap-2 h-10">
            <span className="text-sm text-muted-foreground">Normal</span>
            <Switch
              checked={priority === "urgente"}
              onCheckedChange={(checked) => setPriority(checked ? "urgente" : "normal")}
            />
            <span className={`text-sm ${priority === "urgente" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              Urgente
            </span>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={selectedFormats.length === 0 || createRequest.isPending}
      >
        {createRequest.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Criar Solicitação e Gerar Brief com IA
      </Button>
    </form>
  );
}
