import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AiGenElementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onElementGenerated: (element: any) => void;
    quizId?: string;
    existingElement?: any;
}

export function AiGenElementDialog({ open, onOpenChange, onElementGenerated, quizId, existingElement }: AiGenElementDialogProps) {
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const isRefining = !!existingElement;

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsLoading(true);

        try {
            // Call Supabase Edge Function
            const { data, error } = await supabase.functions.invoke('generate-quiz-element', {
                body: {
                    prompt,
                    quizId,
                    existingElement: isRefining ? { type: existingElement.type, content: existingElement.content } : undefined
                }
            });

            if (error) throw error;

            if (!data || !data.type) {
                throw new Error("Resposta inválida da IA");
            }

            onElementGenerated({
                type: data.type,
                content: data.content
            });

            toast.success("Elemento gerado com sucesso!")
            onOpenChange(false);
            setPrompt("");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar elemento. Verifique se a chave de API está configurada.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-blue-700">
                        <Sparkles className="h-5 w-5" />
                        {isRefining ? "Refinar Elemento com IA" : "Gerar Elemento com IA"}
                    </DialogTitle>
                    <DialogDescription>
                        {isRefining
                            ? "Descreva as mudanças ou ajustes que você deseja fazer neste elemento."
                            : "Descreva o elemento que você quer criar e nossa IA irá gerá-lo para você."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Descrição do Elemento</Label>
                        <Textarea
                            placeholder="Ex: Uma pergunta de múltipla escolha sobre a faixa salarial do cliente..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="h-32 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Gerar Elemento
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
