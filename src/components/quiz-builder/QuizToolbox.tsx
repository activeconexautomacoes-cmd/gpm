import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
    Type, Image as ImageIcon, Video, Mic,
    AlertTriangle, Bell, Clock, Loader2,
    ListChecks, CheckSquare, MessageSquare,
    MousePointerClick, FormInput, Mail, Phone, Calendar, HelpCircle, ToggleRight, Gauge, Quote, Tag, Users, Star, Split, BarChart3, GalleryHorizontal, LineChart, MoveVertical, Code2, Sparkles
} from "lucide-react";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface QuizToolboxProps {
    onAddElement: (type: string, content?: any) => void;
    workspaceId?: string;
}

export function QuizToolbox({ onAddElement, workspaceId }: QuizToolboxProps) {
    const [libraryElements, setLibraryElements] = useState<any[]>([]);

    useEffect(() => {
        if (workspaceId) {
            fetchLibrary();
        }
    }, [workspaceId]);

    const fetchLibrary = async () => {
        const { data, error } = await supabase
            .from('custom_quiz_elements' as any)
            .select('*')
            .eq('workspace_id', workspaceId);

        if (!error && data) {
            setLibraryElements(data);
        }
    };

    const categories = [
        {
            title: "Inteligência Artificial",
            items: [
                { type: "ai_gen", label: "Gerar com IA", icon: Loader2, className: "bg-gradient-to-r from-blue-500/10 to-blue-500/10 hover:from-blue-500/20 hover:to-blue-500/20 border-blue-500/30 text-blue-400" },
            ]
        },
        {
            title: "Atenção",
            items: [
                { type: "timer", label: "Timer", icon: Clock },
            ]
        },
        {
            title: "Mídia e Conteúdo",
            items: [
                { type: "text", label: "Texto", icon: Type },
                { type: "image", label: "Imagem", icon: ImageIcon },
                { type: "video", label: "Vídeo", icon: Video },
                { type: "faq", label: "FAQ", icon: HelpCircle },
            ]
        },
        {
            title: "Quiz",
            items: [
                { type: "single_choice", label: "Escolha Única", icon: ListChecks },
                { type: "multiple_choice", label: "Múltipla Escolha", icon: CheckSquare },
                { type: "yes_no", label: "Sim/Não", icon: ToggleRight },
                { type: "level", label: "Nível", icon: Gauge },
                { type: "arguments", label: "Argumentos", icon: Quote },
                { type: "price", label: "Preço", icon: Tag },
                { type: "testimonials", label: "Depoimentos", icon: Users },
                { type: "before_after", label: "Antes/Depois", icon: Split },
                { type: "metrics", label: "Métricas", icon: BarChart3 },
                { type: "carousel", label: "Carrossel", icon: GalleryHorizontal },
                { type: "charts", label: "Gráficos", icon: LineChart },
            ]
        },
        {
            title: "Formulário",
            items: [
                { type: "input", label: "Campo Texto", icon: FormInput },
                { type: "email", label: "E-mail", icon: Mail },
                { type: "phone", label: "Telefone", icon: Phone },
                { type: "button", label: "Botão", icon: MousePointerClick },
            ]
        },
        {
            title: "Agendamento",
            items: [
                { type: "scheduler", label: "Agenda", icon: Calendar },
            ]
        },
        {
            title: "Personalização",
            items: [
                { type: "spacer", label: "Espaço", icon: MoveVertical },
                { type: "custom_code", label: "Customizado", icon: Code2 },
            ]
        }
    ];

    return (
        <div className="w-56 border-r bg-card flex flex-col h-full overflow-hidden">
            <div className="px-4 py-3 border-b bg-card min-h-[49px] flex items-center">
                <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground/60">Componentes</span>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-6">
                    {categories.map((category, i) => (
                        <div key={i} className="space-y-1">
                            <h4 className="px-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-2">
                                {category.title}
                            </h4>
                            <div className="space-y-0.5">
                                {category.items.map((item) => (
                                    <Button
                                        key={item.type}
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start h-9 px-2 gap-3 transition-all duration-200",
                                            "hover:bg-muted text-muted-foreground hover:text-foreground group border border-transparent",
                                            "active:scale-[0.98]",
                                            item.type === 'ai_gen'
                                                ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border-blue-500/20"
                                                : "hover:border-border",
                                            item.className
                                        )}
                                        onClick={() => onAddElement(item.type)}
                                    >
                                        <item.icon className={cn(
                                            "h-4 w-4 transition-colors",
                                            item.type === 'ai_gen' ? "text-blue-400 group-hover:scale-110" : "text-muted-foreground group-hover:text-primary"
                                        )} />
                                        <span className="text-xs font-medium tracking-tight truncate">{item.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ))}

                    {libraryElements.length > 0 && (
                        <div className="space-y-1 pt-4 border-t border-border/50">
                            <h4 className="px-2 text-[10px] font-bold text-blue-400/80 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Sparkles className="h-3 w-3" /> Biblioteca
                            </h4>
                            <div className="space-y-0.5">
                                {libraryElements.map((item) => (
                                    <Button
                                        key={item.id}
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start h-9 px-2 gap-3 transition-all duration-200",
                                            "hover:bg-blue-500/10 hover:text-blue-400 group border border-transparent hover:border-blue-500/20",
                                            "active:scale-[0.98]"
                                        )}
                                        onClick={() => onAddElement(item.type, item.content)}
                                    >
                                        <Sparkles className="h-4 w-4 text-blue-500/60 group-hover:text-blue-400 transition-colors" />
                                        <span className="text-xs font-medium tracking-tight truncate italic">{item.name}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
