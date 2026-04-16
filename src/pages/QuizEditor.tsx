import { useState, useEffect, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QuizBuilderSidebar } from "@/components/quiz-builder/QuizBuilderSidebar";
import { QuizToolbox } from "@/components/quiz-builder/QuizToolbox";
import { QuizBuilderCanvas } from "@/components/quiz-builder/QuizBuilderCanvas";
import { QuizBuilderProperties } from "@/components/quiz-builder/QuizBuilderProperties";
import { QuizResults } from "@/components/quiz-builder/QuizResults";
import { Loader2, Save, Eye, Send, Monitor, Smartphone, ChevronLeft, Settings, LayoutTemplate, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { debounce } from "lodash";
import { AiGenElementDialog } from "@/components/quiz-builder/AiGenElementDialog";
import { QuizSettingsDialog } from "@/components/quiz-builder/QuizSettingsDialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function QuizEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    // State for managing selected identifiers
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [localElements, setLocalElements] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [elementToAdjust, setElementToAdjust] = useState<any | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'editor' | 'leads'>('editor');


    // Fetch Quiz Data
    const { data: quiz, isLoading } = useQuery({
        queryKey: ["quiz", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("quizzes")
                .select("*")
                .eq("id", id)
                .single();
            if (error) throw error;
            return data;
        },
    });

    // Fetch Pages
    const { data: pages, isLoading: isLoadingPages } = useQuery({
        queryKey: ["quiz-pages", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("quiz_questions")
                .select("*")
                .eq("quiz_id", id)
                .order("order");
            if (error) throw error;
            return data;
        },
    });

    // Fetch Elements for selected page
    const { data: elements, isLoading: isLoadingElements } = useQuery({
        queryKey: ["quiz-elements", selectedPageId],
        queryFn: async () => {
            if (!selectedPageId) return [];
            const { data, error } = await supabase
                .from("quiz_elements")
                .select("*")
                .eq("question_id", selectedPageId)
                .order("order_index");
            if (error) throw error;
            return data;
        },
        enabled: !!selectedPageId,
    });

    // Update local state when elements are fetched
    useEffect(() => {
        if (elements) {
            setLocalElements(elements);
        } else if (!isLoadingElements) {
            setLocalElements([]);
        }
    }, [elements, isLoadingElements]);

    // Set initial selected page
    useEffect(() => {
        if (pages && pages.length > 0 && !selectedPageId) {
            setSelectedPageId(pages[0].id);
        }
    }, [pages, selectedPageId]);

    useEffect(() => {
        if (quiz) {
            setEditedTitle(quiz.title || "");

        }
    }, [quiz]);

    // Debounced DB Update for elements
    const updateElementDb = useCallback(
        debounce(async (elementId: string, updates: any) => {
            setIsSaving(true);
            try {
                const { error } = await supabase
                    .from("quiz_elements")
                    .update(updates)
                    .eq("id", elementId);
                if (error) throw error;
            } catch (err: any) {
                toast.error("Erro ao salvar: " + err.message);
            } finally {
                setIsSaving(false);
            }
        }, 1000),
        []
    );

    const handleAddPage = async () => {
        const newOrder = pages?.length || 0;
        const { data, error } = await supabase
            .from("quiz_questions")
            .insert({
                quiz_id: id,
                text: "Nova Página",
                order: newOrder,
                question_type: 'custom'
            })
            .select()
            .single();

        if (error) {
            toast.error("Erro ao adicionar página");
            return;
        }

        queryClient.invalidateQueries({ queryKey: ["quiz-pages", id] });
        setSelectedPageId(data.id);
        toast.success("Página adicionada");
    };

    const handleDeletePage = async (pageId: string) => {
        const { error } = await supabase
            .from("quiz_questions")
            .delete()
            .eq("id", pageId);

        if (error) {
            toast.error("Erro ao excluir página");
            return;
        }

        queryClient.invalidateQueries({ queryKey: ["quiz-pages", id] });
        if (selectedPageId === pageId) {
            setSelectedPageId(null);
        }
        toast.success("Página excluída");
    };

    const handleDuplicatePage = async (pageId: string) => {
        setIsSaving(true);
        try {
            // 1. Fetch source page details
            const { data: sourcePage, error: pageError } = await supabase
                .from("quiz_questions")
                .select("*")
                .eq("id", pageId)
                .single();

            if (pageError) throw pageError;

            // 2. Fetch source page elements and options
            const { data: sourceElements, error: elementsError } = await supabase
                .from("quiz_elements")
                .select("*")
                .eq("question_id", pageId);

            if (elementsError) throw elementsError;

            const { data: sourceOptions, error: optionsError } = await supabase
                .from("quiz_options")
                .select("*")
                .eq("question_id", pageId);

            if (optionsError) throw optionsError;

            // 3. Create new page
            const newOrder = pages?.length || 0;
            const { data: newPage, error: newPageError } = await supabase
                .from("quiz_questions")
                .insert({
                    quiz_id: id,
                    text: `${sourcePage.text} (Cópia)`,
                    order: newOrder,
                    question_type: sourcePage.question_type,
                    is_required: (sourcePage as any).is_required,
                    description: (sourcePage as any).description
                })
                .select()
                .single();

            if (newPageError) throw newPageError;

            // 4. Copy elements
            if (sourceElements && sourceElements.length > 0) {
                const elementsToInsert = sourceElements.map(el => {
                    const { id: _, created_at: __, question_id: ___, ...rest } = el;
                    return {
                        ...rest,
                        question_id: newPage.id
                    };
                });

                const { error: copyElementsError } = await supabase
                    .from("quiz_elements")
                    .insert(elementsToInsert);

                if (copyElementsError) throw copyElementsError;
            }

            // 5. Copy options
            if (sourceOptions && sourceOptions.length > 0) {
                const optionsToInsert = sourceOptions.map(opt => {
                    const { id: _, created_at: __, question_id: ___, ...rest } = opt;
                    return {
                        ...rest,
                        question_id: newPage.id
                    };
                });

                const { error: copyOptionsError } = await supabase
                    .from("quiz_options")
                    .insert(optionsToInsert);

                if (copyOptionsError) throw copyOptionsError;
            }

            toast.success("Etapa duplicada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["quiz-pages", id] });
            setSelectedPageId(newPage.id);
        } catch (err: any) {
            console.error("Error duplicating page:", err);
            toast.error("Erro ao duplicar etapa: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdatePageText = async (pageId: string, newText: string) => {
        // Update local state first for immediate feedback
        const { error } = await supabase
            .from("quiz_questions")
            .update({ text: newText })
            .eq("id", pageId);

        if (error) {
            toast.error("Erro ao atualizar nome da etapa");
            return;
        }

        queryClient.invalidateQueries({ queryKey: ["quiz-pages", id] });
    };

    const handleReorderPages = async (reorderedPages: any[]) => {
        // Update order in database
        const updates = reorderedPages.map((page, index) => ({
            id: page.id,
            order: index
        }));

        // Update all pages with new order
        for (const update of updates) {
            const { error } = await supabase
                .from("quiz_questions")
                .update({ order: update.order })
                .eq("id", update.id);

            if (error) {
                console.error("Error updating page order:", error);
                toast.error("Erro ao reordenar etapas");
                return;
            }
        }

        // Invalidate query to refetch with new order
        queryClient.invalidateQueries({ queryKey: ["quiz-pages", id] });
        toast.success("Ordem das etapas atualizada");
    };


    const handleAddElement = async (type: string, content?: any) => {
        if (!selectedPageId) {
            toast.error("Selecione uma etapa primeiro");
            return;
        }

        if (type === 'ai_gen') {
            setIsAiDialogOpen(true);
            return;
        }

        const newOrder = localElements.length;
        const defaultContent = content ? content : type === 'text' ? { label: "Novo texto" }
            : type === 'button' ? { label: "Continuar" }
                : type === 'faq' ? {
                    label: "Perguntas Frequentes",
                    items: [
                        { question: "Nova Pergunta", answer: "Sua resposta aqui..." }
                    ]
                }
                    : type === 'yes_no' ? {
                        label: "Qual a questão a ser respondida?",
                        description: "Digite aqui uma descrição de ajuda para introduzir o usuário à questão."
                    }
                        : type === 'level' ? {
                            label: "Nível",
                            subtitle: "Sua descrição curta aqui",
                            percentage: 75,
                            showGauge: true,
                            showProgress: true,
                            legends: "Mínimo, Médio, Máximo"
                        }
                            : type === 'arguments' ? {
                                layout: '2-col',
                                arguments: [
                                    { title: "Sua Vantagem 1", description: "Descrição curta do argumento aqui", imageUrl: "" },
                                    { title: "Sua Vantagem 2", description: "Descrição curta do argumento aqui", imageUrl: "" }
                                ]
                            }
                                : type === 'price' ? {
                                    label: "Plano PRO",
                                    highlightText: "TEXTO EM DESTAQUE",
                                    prefix: "10% off",
                                    value: "89,90",
                                    suffix: "à vista",
                                    redirectUrl: "https://www.google.com.br",
                                    shouldRedirect: true,
                                    hasCheckbox: false
                                }
                                    : type === 'testimonials' ? {
                                        displayType: 'list',
                                        testimonials: [
                                            { name: "Rafael Nascimento", handle: "@rafael.nascimento", rating: 5, content: "A experiência foi excelente do início ao fim. Atendimento rápido, equipe super atenciosa e resultados acima do esperado. Com certeza recomendaria!" },
                                            { name: "Camila Ferreira", handle: "@camila.ferreira", rating: 5, content: "Fiquei impressionado com a qualidade e o cuidado em cada detalhe. Superou todas as minhas expectativas. Já virei cliente fiel!" }
                                        ]
                                    }
                                        : type === 'before_after' ? {
                                            beforeImageUrl: "https://images.unsplash.com/photo-1552053831-71594a27632d",
                                            afterImageUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03"
                                        }
                                            : type === 'metrics' ? {
                                                metricsLayout: 'grid-2',
                                                metricsDisposition: 'graphic-legend',
                                                metrics: [
                                                    { label: "Fusce vitae tellus in risus sagittis condimentum", value: 30, type: 'bar' },
                                                    { label: "Fusce vitae tellus in risus sagittis condimentum", value: 30, type: 'bar' }
                                                ]
                                            }
                                                : type === 'carousel' ? {
                                                    carouselLayout: 'image-text',
                                                    showPagination: true,
                                                    autoplay: true,
                                                    autoplaySpeed: 4,
                                                    carouselItems: [
                                                        { imageUrl: "https://images.unsplash.com/photo-1552053831-71594a27632d", description: "Exemplo de descrição" },
                                                        { imageUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03", description: "Exemplo de descrição" }
                                                    ]
                                                }
                                                    : type === 'charts' ? {
                                                        chartType: 'cartesian',
                                                        activeDatasetIndex: 0,
                                                        datasets: [
                                                            { name: "Conjunto A", color: "#64748b", label: "Concorrente", data: [{ label: "Ontem", value: 20 }, { label: "Hoje", value: 40 }, { label: "Amanhã", value: 10 }] },
                                                            { name: "Conjunto B", color: "#ef4444", label: "Você", data: [{ label: "Ontem", value: 10 }, { label: "Hoje", value: 30 }, { label: "Amanhã", value: 90 }] }
                                                        ]
                                                    }
                                                        : type === 'spacer' ? {
                                                            spacerSize: 'medium'
                                                        }
                                                            : type === 'timer' ? {
                                                                timerDuration: 20,
                                                                label: "Resgate agora seu desconto: [time]",
                                                                timerStyle: 'red'
                                                            }
                                                                : type === 'input' ? { label: "Nome completo", placeholder: "Digite seu nome...", crmMapping: "lead_name" }
                                                                    : type === 'email' ? { label: "E-mail corporativo", placeholder: "seu@email.com", crmMapping: "lead_email" }
                                                                        : type === 'phone' ? { label: "WhatsApp", placeholder: "(00) 00000-0000", crmMapping: "lead_phone" }
                                                                            : type === 'custom_code' ? {
                                                                                customCode: "<div class=\"p-8 text-center bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-2xl shadow-xl\"> <h3 class=\"text-xl font-bold mb-2\">Elemento Customizado</h3> <p class=\"text-slate-400 text-sm\">Edite o HTML e CSS no painel lateral para personalizar este componente.</p> </div>",
                                                                                customCss: ""
                                                                            }
                                                                                : { label: "Novo Elemento" };

        // Create in DB immediately to get ID
        const { data, error } = await supabase
            .from("quiz_elements")
            .insert({
                question_id: selectedPageId,
                type: type,
                order_index: newOrder,
                content: defaultContent
            })
            .select()
            .single();

        if (error) {
            toast.error("Erro ao adicionar elemento");
            return;
        }

        setLocalElements([...localElements, data]);
        setSelectedElementId(data.id);
    };

    const handleUpdateElement = (elementId: string, updates: any) => {
        setLocalElements((current) =>
            current.map((el) => (el.id === elementId ? { ...el, ...updates } : el))
        );
        updateElementDb(elementId, updates);
    };

    const handleMoveUp = (elementId: string) => {
        const index = localElements.findIndex(el => el.id === elementId);
        if (index > 0) {
            const newElements = arrayMove(localElements, index, index - 1);
            handleReorderElements(newElements);
        }
    };

    const handleMoveDown = (elementId: string) => {
        const index = localElements.findIndex(el => el.id === elementId);
        if (index < localElements.length - 1) {
            const newElements = arrayMove(localElements, index, index + 1);
            handleReorderElements(newElements);
        }
    };

    const handleDuplicateElement = async (element: any) => {
        const { id: _, created_at: __, ...elementData } = element;
        const newOrder = localElements.length;

        const { data, error } = await supabase
            .from("quiz_elements")
            .insert({
                ...elementData,
                order_index: newOrder,
                question_id: selectedPageId
            })
            .select()
            .single();

        if (error) {
            toast.error("Erro ao duplicar elemento");
            return;
        }

        setLocalElements([...localElements, data]);
        setSelectedElementId(data.id);
        toast.success("Elemento duplicado");
    };

    const handleDeleteElement = async (elementId: string) => {
        const { error } = await supabase
            .from("quiz_elements")
            .delete()
            .eq("id", elementId);

        if (error) {
            toast.error("Erro ao excluir elemento");
            return;
        }

        setLocalElements(current => current.filter(el => el.id !== elementId));
        if (selectedElementId === elementId) setSelectedElementId(null);
        toast.success("Elemento removido");
    };

    const handleReorderElements = async (newElements: any[]) => {
        setLocalElements(newElements);
        setIsSaving(true);
        try {
            const updates = newElements.map((el, index) => ({
                id: el.id,
                order_index: index,
                question_id: selectedPageId,
                type: el.type,
                content: el.content
            }));

            const { error } = await supabase
                .from("quiz_elements")
                .upsert(updates);

            if (error) throw error;
        } catch (err: any) {
            toast.error("Erro ao reordenar: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("quizzes")
                .update({ active: true })
                .eq("id", id);
            if (error) throw error;
            toast.success("Quiz publicado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["quiz", id] });
        } catch (err: any) {
            toast.error("Erro ao publicar: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateQuizTitle = async (newTitle: string) => {
        if (!newTitle.trim()) {
            toast.error("O título não pode estar vazio");
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("quizzes")
                .update({ title: newTitle })
                .eq("id", id);
            if (error) throw error;
            toast.success("Título atualizado!");
            queryClient.invalidateQueries({ queryKey: ["quiz", id] });
        } catch (err: any) {
            toast.error("Erro ao atualizar título: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveQuizSettings = async (settings: any) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("quizzes")
                .update({
                    title: settings.title,
                    slug: settings.slug,
                    active: settings.active,
                    description: settings.description,
                    pixels: settings.pixels,
                    seo: settings.seo,
                    webhook: settings.webhook,
                    scoring_rules: settings.scoring_rules,
                    settings: settings.settings
                })
                .eq("id", id);
            if (error) throw error;
            toast.success("Configurações salvas com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["quiz", id] });
            setIsSettingsOpen(false);
        } catch (err: any) {
            toast.error("Erro ao salvar: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || isLoadingPages) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const selectedPage = pages?.find(p => p.id === selectedPageId);
    const selectedElement = localElements.find(el => el.id === selectedElementId);

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="h-16 border-b bg-background/95 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/quizzes")} className="rounded-full hover:bg-muted">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {isEditingTitle ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    onBlur={() => {
                                        setIsEditingTitle(false);
                                        if (editedTitle !== quiz?.title) {
                                            handleUpdateQuizTitle(editedTitle);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            setIsEditingTitle(false);
                                            if (editedTitle !== quiz?.title) {
                                                handleUpdateQuizTitle(editedTitle);
                                            }
                                        } else if (e.key === 'Escape') {
                                            setEditedTitle(quiz?.title || "");
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                    className="text-sm font-semibold text-foreground bg-transparent border-b-2 border-primary px-1 outline-none min-w-[200px]"
                                />
                            ) : (
                                <h1
                                    className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary transition-colors px-1"
                                    onClick={() => setIsEditingTitle(true)}
                                >
                                    {quiz?.title}
                                </h1>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setIsSettingsOpen(true)}
                            >
                                <Settings className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border">
                    <Button
                        variant={activeTab === 'editor' ? "outline" : "ghost"}
                        size="sm"
                        className={cn(
                            "h-8 px-3 text-xs font-semibold transition-all",
                            activeTab === 'editor' && "bg-background text-primary border-border shadow-sm"
                        )}
                        onClick={() => setActiveTab('editor')}
                    >
                        <LayoutTemplate className="h-3.5 w-3.5 mr-2" />
                        Construtor
                    </Button>
                    <Button
                        variant={activeTab === 'leads' ? "outline" : "ghost"}
                        size="sm"
                        className={cn(
                            "h-8 px-3 text-xs font-semibold transition-all",
                            activeTab === 'leads' && "bg-background text-primary border-border shadow-sm"
                        )}
                        onClick={() => setActiveTab('leads')}
                    >
                        <Users className="h-3.5 w-3.5 mr-2" />
                        Leads e Resultados
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    {activeTab === 'editor' && (
                        <div className="flex bg-muted/50 p-1 rounded-lg border border-border mr-2">
                            <Button
                                variant={previewMode === 'desktop' ? "outline" : "ghost"}
                                size="sm"
                                className={cn("h-8 px-3 text-xs", previewMode === 'desktop' && "bg-background border-border")}
                                onClick={() => setPreviewMode('desktop')}
                            >
                                <Monitor className="h-3.5 w-3.5 mr-2" /> Desktop
                            </Button>
                            <Button
                                variant={previewMode === 'mobile' ? "outline" : "ghost"}
                                size="sm"
                                className={cn("h-8 px-3 text-xs", previewMode === 'mobile' && "bg-background border-border")}
                                onClick={() => setPreviewMode('mobile')}
                            >
                                <Smartphone className="h-3.5 w-3.5 mr-2" /> Mobile
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        {isSaving && (
                            <span className="text-[10px] text-muted-foreground animate-pulse flex items-center">
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Salvando...
                            </span>
                        )}
                        {quiz?.slug ? (
                            <a
                                href={`/quiz/${quiz.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-muted hover:text-accent-foreground h-9 px-4"
                            >
                                <Eye className="h-3.5 w-3.5 mr-2" /> Visualizar
                            </a>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 text-xs"
                                onClick={() => toast.error("Quiz sem slug para visualização")}
                            >
                                <Eye className="h-3.5 w-3.5 mr-2" /> Visualizar
                            </Button>
                        )}
                        <Button onClick={handlePublish} size="sm" className="h-9 px-4 text-xs shadow-lg shadow-primary/20">
                            Publicar
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden relative">
                {activeTab === 'editor' ? (
                    <>
                        {/* Pages Sidebar */}
                        <QuizBuilderSidebar
                            questions={(pages || []) as any}
                            selectedQuestionId={selectedPageId}
                            onSelectQuestion={setSelectedPageId}
                            onAddQuestion={handleAddPage}
                            onDeleteQuestion={handleDeletePage}
                            onDuplicateQuestion={handleDuplicatePage}
                            onUpdateQuestionText={handleUpdatePageText}
                            onReorderQuestions={handleReorderPages}
                            quizSlug={quiz?.slug}
                        />

                        {/* Elements Toolbox */}
                        <QuizToolbox
                            onAddElement={handleAddElement}
                            workspaceId={quiz?.workspace_id}
                        />

                        {/* Canvas Area Container */}
                        <div className="flex-1 bg-muted/20 relative overflow-hidden flex flex-col">
                            <QuizBuilderCanvas
                                title={selectedPage?.text || "Nova Página"}
                                description={""}
                                elements={localElements}
                                selectedElementId={selectedElementId}
                                onSelectElement={setSelectedElementId}
                                onReorderElements={handleReorderElements}
                                onMoveUp={handleMoveUp}
                                onMoveDown={handleMoveDown}
                                onDuplicate={handleDuplicateElement}
                                onDelete={handleDeleteElement}
                                previewMode={previewMode}
                            />
                        </div>

                        {/* Properties Sidebar */}
                        <QuizBuilderProperties
                            page={(selectedPage || null) as any}
                            element={selectedElement || null}
                            allPages={(pages || []) as any}
                            workspaceId={quiz?.workspace_id}
                            quizSettings={(quiz?.settings as any) || {}}
                            onUpdateQuizSettings={async (updates) => {
                                if (!quiz) return;
                                const currentSettings = (quiz.settings as any) || {};
                                const newSettings = {
                                    ...currentSettings,
                                    theme: {
                                        ...(currentSettings.theme || {}),
                                        ...updates
                                    }
                                };

                                // Optimistic update
                                queryClient.setQueryData(["quiz", id], { ...quiz, settings: newSettings });

                                const { error } = await supabase
                                    .from("quizzes")
                                    .update({ settings: newSettings })
                                    .eq("id", id);

                                if (error) {
                                    toast.error("Erro ao atualizar tema");
                                    queryClient.invalidateQueries({ queryKey: ["quiz", id] });
                                }
                            }}
                            onUpdatePage={(updates) => {
                                console.log("Update page", updates);
                            }}
                            onUpdateElement={handleUpdateElement}
                            onAdjustWithAi={(element) => {
                                setElementToAdjust(element);
                                setIsAiDialogOpen(true);
                            }}
                            onDeleteElement={handleDeleteElement}
                        />
                    </>
                ) : (
                    <div className="flex-1 bg-background p-6 overflow-auto">
                        <div className="max-w-7xl mx-auto">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">Leads e Resultados</h2>
                                <p className="text-muted-foreground">Acompanhe as estatísticas e respostas dos seus visitantes.</p>
                            </div>
                            <QuizResults
                                quizId={id!}
                                questions={(pages || []) as any[]}
                            />
                        </div>
                    </div>
                )}
            </main>

            <AiGenElementDialog
                open={isAiDialogOpen}
                onOpenChange={(open) => {
                    setIsAiDialogOpen(open);
                    if (!open) setElementToAdjust(null);
                }}
                quizId={id}
                existingElement={elementToAdjust}
                onElementGenerated={async (aiResult) => {
                    if (elementToAdjust) {
                        // Update existing element
                        handleUpdateElement(elementToAdjust.id, {
                            type: aiResult.type,
                            content: aiResult.content
                        });
                        setElementToAdjust(null);
                    } else {
                        // Create new element
                        const newOrder = localElements.length;
                        const { data, error } = await supabase
                            .from("quiz_elements")
                            .insert({
                                question_id: selectedPageId,
                                type: aiResult.type,
                                order_index: newOrder,
                                content: aiResult.content
                            })
                            .select()
                            .single();

                        if (!error && data) {
                            setLocalElements([...localElements, data]);
                            setSelectedElementId(data.id);
                        }
                    }
                    setIsAiDialogOpen(false);
                }}
            />

            {/* Quiz Settings Dialog */}
            {quiz && (
                <QuizSettingsDialog
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                    quiz={quiz}
                    onSave={handleSaveQuizSettings}
                />
            )}
        </div>
    );
}

function Separator({ className, orientation = "horizontal" }: { className?: string, orientation?: "horizontal" | "vertical" }) {
    return <div className={`bg-slate-200 ${orientation === "horizontal" ? "h-px w-full" : "w-px h-full"} ${className}`} />;
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}
