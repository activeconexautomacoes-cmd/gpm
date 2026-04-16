import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, BrainCircuit, ExternalLink, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Quizzes() {
    const { currentWorkspace, can } = useWorkspace();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [quizToDelete, setQuizToDelete] = useState<string | null>(null);

    const { data: quizzes = [], isLoading } = useQuery({
        queryKey: ["quizzes", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];

            const { data, error } = await supabase
                .from("quizzes")
                .select("*")
                .eq("workspace_id", currentWorkspace.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!currentWorkspace?.id,
    });

    const deleteMutation = useMutation({
        mutationFn: async (quizId: string) => {
            const { error } = await supabase
                .from("quizzes")
                .delete()
                .eq("id", quizId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["quizzes"] });
            toast.success("Quiz excluído com sucesso!");
            setQuizToDelete(null);
        },
        onError: (error) => {
            console.error("Erro ao excluir quiz:", error);
            toast.error("Erro ao excluir quiz");
        },
    });

    const duplicateMutation = useMutation({
        mutationFn: async (quizId: string) => {
            const { data, error } = await supabase.rpc('duplicate_quiz', {
                target_quiz_id: quizId
            });

            if (error) throw error;
            return data;
        },
        onSuccess: (newQuizId) => {
            queryClient.invalidateQueries({ queryKey: ["quizzes"] });
            toast.success("Quiz duplicado com sucesso!");
            if (newQuizId) {
                navigate(`/dashboard/quizzes/${newQuizId}`);
            }
        },
        onError: (error) => {
            console.error("Erro ao duplicar quiz:", error);
            toast.error("Erro ao duplicar quiz");
        },
    });

    if (!can("quizzes.view")) {
        return (
            <div className="container mx-auto p-6 flex flex-col items-center justify-center h-[50vh]">
                <BrainCircuit className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                <p className="text-muted-foreground">Você não tem permissão para visualizar os quizzes.</p>
            </div>
        );
    }

    const filteredQuizzes = quizzes.filter((quiz) =>
        quiz.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateQuiz = async () => {
        if (!currentWorkspace?.id) return;

        // Create a new draft quiz
        const { data, error } = await supabase
            .from("quizzes")
            .insert({
                title: "Novo Quiz",
                slug: `quiz-${Date.now()}`, // Temporary slug
                workspace_id: currentWorkspace.id,
                active: false
            })
            .select()
            .single();

        if (error) {
            toast.error("Erro ao criar quiz");
            return;
        }

        if (data) {
            toast.success("Quiz criado! Redirecionando para edição...");
            navigate(`/dashboard/quizzes/${data.id}`);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Quizzes</h1>
                    <p className="text-muted-foreground">Crie quizzes interativos para qualificação de leads</p>
                </div>
                {can("quizzes.manage") && (
                    <Button onClick={handleCreateQuiz}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Quiz
                    </Button>
                )}
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar quizzes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Slug (URL)</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Criado em</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredQuizzes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                    {isLoading ? (
                                        "Carregando..."
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <BrainCircuit className="h-8 w-8 text-muted-foreground/50" />
                                            <p>Nenhum quiz encontrado</p>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredQuizzes.map((quiz) => (
                                <TableRow key={quiz.id}>
                                    <TableCell className="font-medium">{quiz.title}</TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">{quiz.slug}</TableCell>
                                    <TableCell>
                                        <Badge variant={quiz.active ? "default" : "secondary"}>
                                            {quiz.active ? "Ativo" : "Rascunho"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(quiz.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Visualizar (Link Público)"
                                                onClick={() => window.open(`/quiz/${quiz.slug}`, '_blank')}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                            {can("quizzes.manage") && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Editar Quiz"
                                                        onClick={() => navigate(`/dashboard/quizzes/${quiz.id}`)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Duplicar Quiz"
                                                        onClick={() => duplicateMutation.mutate(quiz.id)}
                                                        disabled={duplicateMutation.isPending}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Excluir Quiz"
                                                        onClick={() => setQuizToDelete(quiz.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!quizToDelete} onOpenChange={() => setQuizToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este quiz? Todas as perguntas e respostas coletadas serão perdidas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => quizToDelete && deleteMutation.mutate(quizToDelete)}
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
