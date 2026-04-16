import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type QuestionEditorSheetProps = {
    questionId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type Option = {
    id: string;
    text: string;
    score_assessoria: number;
    score_mentoria: number;
    order: number;
};

export function QuestionEditorSheet({
    questionId,
    open,
    onOpenChange,
}: QuestionEditorSheetProps) {
    const queryClient = useQueryClient();
    const [questionText, setQuestionText] = useState("");

    // Fetch Question & Options
    const { data: questionData, isLoading } = useQuery({
        queryKey: ["question-details", questionId],
        queryFn: async () => {
            if (!questionId) return null;

            const { data: question, error: qError } = await supabase
                .from("quiz_questions")
                .select("*")
                .eq("id", questionId)
                .single();

            if (qError) throw qError;

            const { data: options, error: oError } = await supabase
                .from("quiz_options")
                .select("*")
                .eq("question_id", questionId)
                .order("order", { ascending: true });

            if (oError) throw oError;

            return { question, options: options || [] };
        },
        enabled: !!questionId && open,
    });

    useEffect(() => {
        if (questionData?.question) {
            setQuestionText(questionData.question.text);
        }
    }, [questionData]);

    const updateQuestionMutation = useMutation({
        mutationFn: async (text: string) => {
            if (!questionId) return;
            const { error } = await supabase
                .from("quiz_questions")
                .update({ text })
                .eq("id", questionId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["quiz-questions"] });
            toast.success("Pergunta atualizada");
        },
    });

    const addOptionMutation = useMutation({
        mutationFn: async () => {
            if (!questionId) return;
            const currentOrder = questionData?.options.length || 0;
            const { error } = await supabase.from("quiz_options").insert({
                question_id: questionId,
                text: "Nova Opção",
                score_assessoria: 0,
                score_mentoria: 0,
                order: currentOrder,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["question-details", questionId] });
        },
    });

    const updateOptionMutation = useMutation({
        mutationFn: async (option: Option) => {
            const { error } = await supabase
                .from("quiz_options")
                .update({
                    text: option.text,
                    score_assessoria: option.score_assessoria,
                    score_mentoria: option.score_mentoria,
                })
                .eq("id", option.id);
            if (error) throw error;
        },
        onSuccess: () => {
            // Silent success for strict inputs to avoid toast spam
        },
    });

    const deleteOptionMutation = useMutation({
        mutationFn: async (optionId: string) => {
            const { error } = await supabase
                .from("quiz_options")
                .delete()
                .eq("id", optionId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["question-details", questionId] });
            toast.success("Opção removida");
        },
    });

    // Debounced update for option fields to avoid too many requests
    const handleOptionChange = (
        option: Option,
        field: keyof Option,
        value: string | number
    ) => {
        // Optimistic update local logic could be complex here due to react-query
        // For now, let's just trigger the mutation directly but we might want to debounce in a production app
        // Simulating immediate feedback by mutating the cached data or just triggering mutation
        // We'll update the mutation to just take the payload

        // NOTE: In a real app we'd debounce this. For this MVP we will call update onBlur or strict controlled input
        // Let's implement onBlur updates in the UI for performance
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl flex flex-col h-full bg-background" side="right">
                <SheetHeader className="px-1">
                    <SheetTitle>Editar Pergunta</SheetTitle>
                    <SheetDescription>Configure a pergunta e suas opções de resposta</SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="space-y-4 mt-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 mt-6 overflow-hidden h-full pb-6">
                        <div className="space-y-2 px-1">
                            <Label htmlFor="q-text">Texto da Pergunta</Label>
                            <Input
                                id="q-text"
                                value={questionText}
                                onChange={(e) => setQuestionText(e.target.value)}
                                onBlur={() => {
                                    if (questionText !== questionData?.question.text) {
                                        updateQuestionMutation.mutate(questionText);
                                    }
                                }}
                            />
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between px-1">
                            <h3 className="font-semibold text-sm">Opções de Resposta</h3>
                            <Button size="sm" variant="outline" onClick={() => addOptionMutation.mutate()}>
                                <Plus className="h-3.5 w-3.5 mr-2" />
                                Adicionar Opção
                            </Button>
                        </div>

                        <ScrollArea className="flex-1 pr-4 -mr-4 h-[calc(100vh-300px)]">
                            <div className="space-y-4 px-1 pb-4">
                                {questionData?.options.map((option: Option, index: number) => (
                                    <div key={option.id} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                                        <div className="flex items-start gap-2">
                                            <div className="mt-2.5 text-muted-foreground cursor-grab">
                                                <GripVertical className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Texto da Opção</Label>
                                                    <Input
                                                        defaultValue={option.text}
                                                        onBlur={(e) => updateOptionMutation.mutate({ ...option, text: e.target.value })}
                                                    />
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="flex-1 space-y-1">
                                                        <Label className="text-xs text-blue-600 font-medium">Pts. Assessoria</Label>
                                                        <Input
                                                            type="number"
                                                            defaultValue={option.score_assessoria}
                                                            onBlur={(e) => updateOptionMutation.mutate({ ...option, score_assessoria: Number(e.target.value) })}
                                                            className="border-blue-200 focus-visible:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <Label className="text-xs text-blue-600 font-medium">Pts. Mentoria</Label>
                                                        <Input
                                                            type="number"
                                                            defaultValue={option.score_mentoria}
                                                            onBlur={(e) => updateOptionMutation.mutate({ ...option, score_mentoria: Number(e.target.value) })}
                                                            className="border-blue-200 focus-visible:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive mt-1"
                                                onClick={() => deleteOptionMutation.mutate(option.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {questionData?.options.length === 0 && (
                                    <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                                        Nenhuma opção criada.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
