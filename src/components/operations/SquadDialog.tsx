
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Squad } from "@/types/operations";

interface SquadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    squadToEdit?: Squad | null;
}

interface SquadFormData {
    name: string;
    color: string;
    leader_id: string;
}

export function SquadDialog({ open, onOpenChange, squadToEdit }: SquadDialogProps) {
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { register, handleSubmit, reset, setValue } = useForm<SquadFormData>();

    useEffect(() => {
        if (squadToEdit) {
            setValue("name", squadToEdit.name);
            setValue("color", squadToEdit.color);
            setValue("leader_id", squadToEdit.leader_id || "");
        } else {
            reset({
                name: "",
                color: "#000000",
                leader_id: "",
            });
        }
    }, [squadToEdit, open, reset, setValue]);

    const { data: members } = useQuery({
        queryKey: ["workspace-members-profiles", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("workspace_members")
                .select(`
          user_id,
          profiles (
            id,
            full_name
          )
        `)
                .eq("workspace_id", currentWorkspace.id);

            if (error) throw error;
            // Cast to any to avoid complex type matching for now
            return (data as any[]).map(m => m.profiles).filter(p => p !== null) as { id: string, full_name: string }[];
        },
        enabled: !!currentWorkspace?.id,
    });

    const mutation = useMutation({
        mutationFn: async (data: SquadFormData) => {
            if (!currentWorkspace?.id) throw new Error("No workspace selected");

            const payload = {
                name: data.name,
                color: data.color,
                leader_id: data.leader_id || null,
                workspace_id: currentWorkspace.id,
            };

            if (squadToEdit) {
                const { error } = await (supabase as any)
                    .from("squads")
                    .update(payload)
                    .eq("id", squadToEdit.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from("squads")
                    .insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["squads"] });
            toast({
                title: squadToEdit ? "Squad atualizado" : "Squad criado",
                description: `O squad foi ${squadToEdit ? "atualizado" : "criado"} com sucesso.`,
            });
            onOpenChange(false);
            reset();
        },
        onError: (error) => {
            console.error("Error saving squad:", error);
            toast({
                variant: "destructive",
                title: "Erro ao salvar squad",
                description: "Ocorreu um erro ao tentar salvar o squad.",
            });
        },
    });

    const onSubmit = (data: SquadFormData) => {
        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{squadToEdit ? "Editar Squad" : "Novo Squad"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome do Squad</Label>
                        <Input id="name" {...register("name", { required: true })} placeholder="Ex: Squad Alpha" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="color">Cor</Label>
                        <div className="flex gap-2">
                            <Input id="color" type="color" className="w-12 h-10 p-1" {...register("color")} />
                            <Input {...register("color")} placeholder="#000000" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="leader">Líder do Squad</Label>
                        <Select
                            onValueChange={(value) => setValue("leader_id", value)}
                            defaultValue={squadToEdit?.leader_id || ""}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um líder" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sem líder</SelectItem> {/* Handle empty string better? */}
                                {members?.map((member) => (
                                    <SelectItem key={member.id} value={member.id}>
                                        {member.full_name || "Sem nome"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
