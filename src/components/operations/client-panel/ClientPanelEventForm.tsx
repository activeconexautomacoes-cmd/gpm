import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTimelineEvent } from "@/hooks/useClientPanelTimeline";
import { EVENT_TYPE_CONFIG, type ClientPanelEventType } from "@/types/clientPanel";

const schema = z.object({
  event_type: z.string().min(1, "Selecione o tipo"),
  content: z.string().min(1, "Descreva o evento"),
  occurred_at: z.string().min(1, "Informe a data"),
  previous_name: z.string().optional(),
  new_name: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ClientPanelEventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
}

export function ClientPanelEventForm({ open, onOpenChange, contractId }: ClientPanelEventFormProps) {
  const createEvent = useCreateTimelineEvent(contractId);

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      event_type: "",
      content: "",
      occurred_at: new Date().toISOString().split("T")[0],
      previous_name: "",
      new_name: "",
    },
  });

  const eventType = watch("event_type");
  const isChangeEvent = eventType === "mudanca_gestor" || eventType === "mudanca_cs";

  const onSubmit = (data: FormData) => {
    const metadata: Record<string, unknown> = {};
    if (isChangeEvent) {
      if (data.previous_name) metadata.previous_name = data.previous_name;
      if (data.new_name) metadata.new_name = data.new_name;
    }

    createEvent.mutate(
      {
        event_type: data.event_type as ClientPanelEventType,
        content: data.content,
        occurred_at: data.occurred_at,
        metadata,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Evento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de evento</Label>
            <Controller
              control={control}
              name="event_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.event_type && <p className="text-xs text-destructive">{errors.event_type.message}</p>}
          </div>

          {/* Metadata for change events */}
          {isChangeEvent && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>De (anterior)</Label>
                <Input placeholder="Nome anterior" {...register("previous_name")} />
              </div>
              <div className="space-y-2">
                <Label>Para (novo)</Label>
                <Input placeholder="Nome novo" {...register("new_name")} />
              </div>
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label>Descricao</Label>
            <Textarea
              placeholder="Descreva o que aconteceu..."
              rows={4}
              {...register("content")}
            />
            {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" {...register("occurred_at")} />
            {errors.occurred_at && <p className="text-xs text-destructive">{errors.occurred_at.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
