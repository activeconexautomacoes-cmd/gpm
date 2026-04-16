import { useState } from "react";
import { ChevronRight, ChevronLeft, Image as ImageIcon, Video, Type, CheckCircle2, Circle, Smartphone, Mail, Phone, MousePointerClick, GripVertical, Check, X, Plus, HelpCircle, ToggleRight, Gauge, Quote, Tag, Star, Split, Clock, Trash2, Copy, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ElementContent = {
    label?: string;
    placeholder?: string;
    options?: { label: string; value: string }[];
    url?: string;
    buttonText?: string;
    description?: string;
    subtitle?: string;
    percentage?: number;
    showGauge?: boolean;
    showProgress?: boolean;
    indicatorText?: string;
    legends?: string;
    arguments?: { title: string; description: string; imageUrl?: string }[];
    layout?: '1-col' | '2-col';
    highlightText?: string;
    prefix?: string;
    value?: string;
    suffix?: string;
    redirectUrl?: string;
    shouldRedirect?: boolean;
    hasCheckbox?: boolean;
    displayType?: 'list' | 'grid' | 'slide';
    testimonials?: { name: string; handle?: string; rating: number; content: string; imageUrl?: string }[];
    beforeImageUrl?: string;
    afterImageUrl?: string;
    metricsLayout?: 'list' | 'grid-2' | 'grid-3' | 'grid-4';
    metricsDisposition?: 'graphic-legend' | 'legend-graphic';
    metrics?: { label: string; value: number; type: 'bar' | 'circle'; color?: string }[];
    carouselItems?: { imageUrl: string; description?: string }[];
    carouselLayout?: 'image-text' | 'image-only';
    showPagination?: boolean;
    autoplay?: boolean;
    autoplaySpeed?: number;
    chartType?: 'cartesian' | 'bar' | 'circular';
    activeDatasetIndex?: number;
    datasets?: {
        name: string;
        color: string;
        label?: string;
        data: { label: string; value: number }[]
    }[];
    timerDuration?: number;
    timerText?: string;
    timerStyle?: 'red' | 'blue' | 'green' | 'dark';
    spacerSize?: 'small' | 'medium' | 'large' | 'xlarge';
    customCode?: string;
    customCss?: string;
    items?: { question: string; answer: string }[];
    type?: string;
    emoji?: string;
    appearance?: {
        layout?: 'list' | 'grid-2' | 'grid-3' | 'grid-4' | 'spread';
        alignment?: 'left' | 'center' | 'right';
        verticalAlignment?: 'auto' | 'start' | 'center' | 'end';
        spacing?: 'compact' | 'normal' | 'relaxed';
        borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
        shadow?: 'none' | 'sm' | 'md' | 'lg';
        width?: number;
        style?: 'simple' | 'highlight' | 'relief' | 'contrast';
        transparentBackground?: boolean;
        orientation?: 'horizontal' | 'vertical';
        imageRatio?: 'auto' | 'square' | 'video' | 'portrait';
        disposition?: 'image-text' | 'text-image' | 'image-only' | 'text-only';
        detail?: 'none' | 'arrow' | 'checkbox' | 'points' | 'value';
    };
    display?: {
        delay?: number;
        rules?: { condition: string; operator: string; value: string }[];
    };
};

type QuizElement = {
    id: string;
    type: string;
    content: ElementContent;
    order_index: number;
};

interface QuizBuilderCanvasProps {
    title: string;
    description?: string;
    elements: QuizElement[];
    selectedElementId: string | null;
    onSelectElement: (id: string) => void;
    onReorderElements: (newElements: QuizElement[]) => void;
    onMoveUp?: (id: string) => void;
    onMoveDown?: (id: string) => void;
    onDuplicate?: (element: QuizElement) => void;
    onDelete?: (id: string) => void;
    previewMode?: 'desktop' | 'mobile';
}

interface SortableItemProps {
    element: QuizElement;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onMoveUp?: (id: string) => void;
    onMoveDown?: (id: string) => void;
    onDuplicate?: (element: QuizElement) => void;
    onDelete?: (id: string) => void;
}

function SortableItem({
    element,
    isSelected,
    onSelect,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onDelete
}: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: element.id });
    const [sliderPos, setSliderPos] = useState(50);
    const [carouselIndex, setCarouselIndex] = useState(0);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    const appearance = element.content.appearance || {}; // Ensure appearance is available

    // Helper classes for appearance
    const contentRadius = appearance.borderRadius === 'none' ? 'rounded-none' :
        appearance.borderRadius === 'sm' ? 'rounded-sm' :
            appearance.borderRadius === 'md' ? 'rounded-md' :
                appearance.borderRadius === 'lg' ? 'rounded-lg' :
                    appearance.borderRadius === 'full' ? 'rounded-full' : ''; // Default handled by component if needed

    const contentShadow = appearance.shadow === 'none' ? 'shadow-none' :
        appearance.shadow === 'sm' ? 'shadow-sm' :
            appearance.shadow === 'md' ? 'shadow-md' :
                appearance.shadow === 'lg' ? 'shadow-lg' : 'shadow-none';

    const wrapperClass = cn(
        "relative group border-2 rounded-lg transition-all cursor-default",
        element.type === 'custom_code' ? "" : "bg-card",
        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-transparent hover:border-border hover:bg-muted/50",
        isDragging && "opacity-50 border-primary shadow-lg z-50",
        appearance.alignment === 'center' ? 'mx-auto' : appearance.alignment === 'right' ? 'ml-auto' : 'mr-auto'
    );

    const containerStyle: React.CSSProperties = {
        width: appearance.width ? `${appearance.width}%` : '100%',
        marginBottom: appearance.spacing === 'compact' ? '0.5rem' : appearance.spacing === 'relaxed' ? '2.0rem' : '1.0rem',
        ...style
    };

    const renderElementContent = () => {
        switch (element.type) {
            case 'text':
                return (
                    <div className={cn(
                        "p-3",
                        (appearance.shadow && appearance.shadow !== 'none') ? `bg-card border border-border ${contentRadius} ${contentShadow}` : ""
                    )}>
                        <p className={cn(
                            "text-card-foreground whitespace-pre-wrap",
                            appearance.alignment === 'center' ? 'text-center' : appearance.alignment === 'right' ? 'text-right' : 'text-left'
                        )}>
                            {element.content.label || "Texto..."}
                        </p>
                    </div>
                );
            case 'image':
                return (
                    <div className="p-3">
                        {element.content.type === 'emoji' ? (
                            <div className={cn(
                                "w-full flex items-center justify-center p-8 bg-muted border-2 border-dashed border-border",
                                contentRadius || "rounded-2xl",
                                contentShadow
                            )}>
                                <span className="text-6xl animate-bounce-slow">
                                    {element.content.emoji || "✨"}
                                </span>
                            </div>
                        ) : element.content.url ? (
                            <img
                                src={element.content.url}
                                alt="Element"
                                className={cn(
                                    "w-full h-auto border border-border",
                                    contentRadius || "rounded-2xl",
                                    contentShadow || "shadow-sm"
                                )}
                            />
                        ) : (
                            <div className={cn(
                                "w-full h-40 bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground gap-2",
                                contentRadius || "rounded-2xl"
                            )}>
                                <ImageIcon className="h-10 w-10 opacity-20" />
                                <span className="text-xs font-medium">Nenhuma imagem selecionada</span>
                            </div>
                        )}
                    </div>
                );
            case 'video':
                const getEmbedUrl = (url: string) => {
                    if (!url) return null;

                    // YouTube
                    if (url.includes('youtube.com') || url.includes('youtu.be')) {
                        const id = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
                        return `https://www.youtube.com/embed/${id}`;
                    }
                    // Vimeo
                    if (url.includes('vimeo.com')) {
                        const id = url.split('/').pop();
                        return `https://player.vimeo.com/video/${id}`;
                    }
                    // Loom
                    if (url.includes('loom.com')) {
                        const id = url.split('/').pop();
                        return `https://www.loom.com/embed/${id}`;
                    }
                    // Vturb (vturb.com.br / panda video etc can be handled here if needed)
                    // For others, return as is if it looks like an embed, or try to use as raw
                    return url;
                };

                const embedUrl = getEmbedUrl(element.content.url);

                return (
                    <div className="p-3 space-y-2">
                        {element.content.label && (
                            <label className="text-sm font-medium text-foreground/80 block mb-1">
                                {element.content.label}
                            </label>
                        )}
                        {element.content.type === 'upload' ? (
                            <div className={cn(
                                "w-full aspect-video bg-black overflow-hidden border border-slate-200",
                                contentRadius || "rounded-2xl",
                                contentShadow || "shadow-lg"
                            )}>
                                {element.content.url ? (
                                    <video src={element.content.url} controls className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                                        <Video className="h-10 w-10 opacity-20" />
                                        <span className="text-xs font-medium">Nenhum vídeo carregado</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={cn(
                                "w-full aspect-video bg-slate-900 overflow-hidden border border-slate-800",
                                contentRadius || "rounded-2xl",
                                contentShadow || "shadow-lg"
                            )}>
                                {embedUrl ? (
                                    <iframe
                                        src={embedUrl}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                                        <Video className="h-10 w-10 opacity-20" />
                                        <span className="text-xs font-medium">Insira uma URL de vídeo</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            case 'input':
            case 'email':
            case 'phone':
                return (
                    <div className="p-3 space-y-2">
                        <label className="text-sm font-medium text-muted-foreground block">{element.content.label || "Rótulo"}</label>
                        <div className={cn(
                            "h-10 w-full border border-input bg-background px-3 flex items-center text-muted-foreground text-sm",
                            contentRadius || "rounded-md",
                            contentShadow
                        )}>
                            {element.type === 'email' && <Mail className="h-4 w-4 mr-2" />}
                            {element.type === 'phone' && <Phone className="h-4 w-4 mr-2" />}
                            {element.content.placeholder || "Digite aqui..."}
                        </div>
                    </div>
                );
            case 'single_choice':
            case 'multiple_choice':
                const choicesAppearance = element.content.appearance || {};

                // Layout Logic
                const gridClass = choicesAppearance.layout === 'grid-2' ? 'grid grid-cols-2 gap-2' :
                    choicesAppearance.layout === 'grid-3' ? 'grid grid-cols-3 gap-2' :
                        choicesAppearance.layout === 'grid-4' ? 'grid grid-cols-4 gap-2' :
                            choicesAppearance.layout === 'spread' ? 'flex flex-wrap gap-2 justify-center' :
                                'space-y-2';

                // Styling Logic
                const optionBorderRadius = choicesAppearance.borderRadius === 'none' ? 'rounded-none' :
                    choicesAppearance.borderRadius === 'sm' ? 'rounded-md' :
                        choicesAppearance.borderRadius === 'lg' ? 'rounded-2xl' :
                            choicesAppearance.borderRadius === 'full' ? 'rounded-full' : 'rounded-lg';

                const optionShadow = choicesAppearance.shadow === 'none' ? 'shadow-none' :
                    choicesAppearance.shadow === 'sm' ? 'shadow-sm' :
                        choicesAppearance.shadow === 'md' ? 'shadow-md' :
                            choicesAppearance.shadow === 'lg' ? 'shadow-lg' : 'shadow-none';

                // Theme Styles
                const themeClasses = choicesAppearance.style === 'highlight' ? 'border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10 text-primary font-semibold' :
                    choicesAppearance.style === 'relief' ? 'bg-muted/30 border-b-4 border-border active:border-b-0 active:translate-y-1' :
                        choicesAppearance.style === 'contrast' ? 'bg-foreground text-background border-transparent hover:bg-foreground/90' :
                            'bg-card border-border hover:border-primary/30 hover:bg-muted/30';

                const transparentClass = choicesAppearance.transparentBackground ? '!bg-transparent' : '';

                return (
                    <div className="p-3">
                        <label className={cn(
                            "text-sm font-medium text-muted-foreground block mb-3",
                            choicesAppearance.alignment === 'center' ? 'text-center' : choicesAppearance.alignment === 'right' ? 'text-right' : 'text-left'
                        )}>
                            {element.content.label || "Pergunta"}
                        </label>
                        <div className={gridClass}>
                            {(element.content.options || [{ label: 'Opção 1', value: '1' }, { label: 'Opção 2', value: '2' }]).map((opt: any, idx) => {
                                const hasImage = (opt.mediaType === 'image' && !!opt.imageUrl) || (!opt.mediaType && !!opt.imageUrl);
                                // Emojis are NOT considered "media" for layout purposes anymore (requested by user)
                                const hasMedia = hasImage;

                                const disposition = choicesAppearance.disposition || 'image-text';
                                const imageRatioClass = choicesAppearance.imageRatio === 'square' ? 'aspect-square' :
                                    choicesAppearance.imageRatio === 'video' ? 'aspect-video' :
                                        choicesAppearance.imageRatio === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';

                                return (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "p-3 border flex items-center gap-3 transition-all cursor-pointer relative overflow-hidden",
                                            optionBorderRadius,
                                            optionShadow,
                                            themeClasses,
                                            transparentClass,
                                            choicesAppearance.alignment === 'center' ? 'flex-col justify-center text-center' : choicesAppearance.alignment === 'right' ? 'flex-row-reverse text-right' : 'flex-row',
                                            choicesAppearance.layout === 'spread' && "min-w-[120px] flex-1",
                                            // Removed forced flex-col here to allow side-by-side

                                        )}
                                    >
                                        {/* Detail: Checkbox - Hide if center aligned */}
                                        {(choicesAppearance.detail === 'checkbox' || choicesAppearance.detail === 'none' || !choicesAppearance.detail) && choicesAppearance.alignment !== 'center' && (
                                            element.type === 'multiple_choice'
                                                ? <div className={cn("h-4 w-4 border-2 rounded shrink-0", choicesAppearance.style === 'contrast' ? "border-muted-foreground/30 bg-background/20" : "bg-muted/50 border-border")} />
                                                : <div className={cn("h-4 w-4 border-2 rounded-full shrink-0", choicesAppearance.style === 'contrast' ? "border-muted-foreground/30 bg-background/20" : "bg-muted/50 border-border")} />
                                        )}

                                        <div className={cn("flex flex-1 min-w-0 w-full items-center",
                                            (hasMedia && (disposition === 'image-text' || disposition === 'text-image')) ? "flex-row gap-3" : "flex-row"
                                        )}>
                                            {/* Media Rendering - Now discreet thumbnail */}
                                            {hasMedia && disposition !== 'text-only' && (
                                                <div className={cn(
                                                    "rounded overflow-hidden bg-muted relative shrink-0 border border-border",
                                                    // Fixed size for discreet look
                                                    "w-12 h-12",
                                                    disposition === 'text-image' && "order-2 ml-auto",
                                                    disposition === 'image-text' && "order-1"
                                                )}>
                                                    <img src={opt.imageUrl} alt={opt.label} className="w-full h-full object-cover" />
                                                </div>
                                            )}

                                            {/* Text Rendering */}
                                            {disposition !== 'image-only' && (
                                                <div className={cn(
                                                    "flex-1",
                                                    (hasMedia && disposition === 'text-image') ? "order-1" : "order-2"
                                                )}>
                                                    <span className={cn(
                                                        "text-xs truncate font-medium block",
                                                        choicesAppearance.style === 'contrast' ? "text-background" : "text-foreground",
                                                        choicesAppearance.style === 'highlight' && "text-primary"
                                                    )}>
                                                        {opt.mediaType === 'emoji' && opt.emoji && <span className="mr-1.5 inline-block">{opt.emoji}</span>}
                                                        {opt.label}
                                                    </span>
                                                    {/* Detail: Value */}
                                                    {choicesAppearance.detail === 'value' && (
                                                        <span className="text-[10px] opacity-60 block mt-0.5">Valor: {idx + 1}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Detail: Arrow */}
                                        {choicesAppearance.detail === 'arrow' && !hasImage && (
                                            <ChevronRight className="h-4 w-4 opacity-50 ml-auto" />
                                        )}
                                        {choicesAppearance.detail === 'points' && !hasImage && (
                                            <div className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold ml-auto">
                                                +10
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 'button':
                return (
                    <div className="p-3">
                        <Button className={cn(
                            "w-full h-11 text-base font-semibold pointer-events-none",
                            contentRadius || "rounded-md", // Default rounded-md
                            contentShadow || "shadow-md"
                        )}>
                            {element.content.buttonText || element.content.label || "Continuar"}
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                );
            case 'price':
                return (
                    <div className="p-4">
                        <div className={cn(
                            "border border-primary/50 overflow-hidden bg-card",
                            contentRadius || "rounded-2xl",
                            contentShadow || "shadow-sm"
                        )}>
                            {element.content.highlightText && (
                                <div className="bg-slate-900 py-1.5 px-4 text-center">
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                                        {element.content.highlightText}
                                    </span>
                                </div>
                            )}
                            <div className="p-5 flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                                        {element.content.label || "Plano PRO"}
                                    </h3>
                                </div>
                                <div className={cn(
                                    "bg-muted/50 border p-3 min-w-[120px] text-right flex flex-col justify-center",
                                    contentRadius ? contentRadius : "rounded-2xl"
                                )}>
                                    {element.content.prefix && (
                                        <span className="text-[9px] text-slate-400 font-medium block">
                                            {element.content.prefix}
                                        </span>
                                    )}
                                    <div className="flex items-baseline justify-end gap-1">
                                        <span className="text-[10px] font-bold text-card-foreground italic">R$</span>
                                        <span className="text-xl font-bold text-card-foreground leading-none">
                                            {element.content.value || "89,90"}
                                        </span>
                                    </div>
                                    {element.content.suffix && (
                                        <span className="text-[9px] text-slate-400 font-medium block">
                                            {element.content.suffix}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'before_after':
                return (
                    <div className="p-4">
                        <div className={cn(
                            "relative aspect-square overflow-hidden bg-slate-100 group",
                            contentRadius || "rounded-2xl" // default
                        )}>
                            {/* After Image (Background) */}
                            <img
                                src={element.content.afterImageUrl || "https://images.unsplash.com/photo-1550009158-9ebf69173e03"}
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                alt="Depois"
                            />

                            {/* Before Image (Clipping) */}
                            <div
                                className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
                                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                            >
                                <img
                                    src={element.content.beforeImageUrl || "https://images.unsplash.com/photo-1552053831-71594a27632d"}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    alt="Antes"
                                />
                            </div>

                            {/* Slider Overlay for interaction */}
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={sliderPos}
                                onChange={(e) => setSliderPos(parseInt(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 hover:opacity-10 pointer-events-auto cursor-ew-resize z-10"
                            />

                            {/* Slider Handle (Visual Only) */}
                            <div
                                className="absolute inset-y-0 w-1 bg-white flex items-center justify-center pointer-events-none z-20"
                                style={{ left: `${sliderPos}%` }}
                            >
                                <div className="h-8 w-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-slate-200">
                                    <ChevronLeft className="h-4 w-4 text-slate-400 -mr-1" />
                                    <ChevronRight className="h-4 w-4 text-slate-400 -ml-1" />
                                </div>
                            </div>

                            {/* Labels */}
                            <div className="absolute bottom-4 left-4 inline-flex px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] text-white font-bold uppercase tracking-wider pointer-events-none">
                                Antes
                            </div>
                            <div className="absolute bottom-4 right-4 inline-flex px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] text-white font-bold uppercase tracking-wider pointer-events-none">
                                Depois
                            </div>
                        </div>
                    </div>
                );
            case 'custom_code':
                return (
                    <div className="w-full">
                        <style dangerouslySetInnerHTML={{ __html: element.content.customCss || '' }} />
                        <div dangerouslySetInnerHTML={{ __html: element.content.customCode || '<div class="p-8 text-center border-2 border-dashed rounded-xl text-slate-400">Elemento Personalizado Vazio</div>' }} />
                    </div>
                );
            case 'timer':
                const duration = element.content.timerDuration || 20;
                const rawText = element.content.label || element.content.timerText || "Resgate agora seu desconto: [time]";
                const timerStyle = element.content.timerStyle || 'red';

                const formatTime = (seconds: number) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                };

                const styleClasses = {
                    red: "bg-red-50 border-red-200 text-red-600",
                    blue: "bg-blue-50 border-blue-200 text-blue-600",
                    green: "bg-green-50 border-green-200 text-green-600",
                    dark: "bg-slate-900 border-slate-800 text-white"
                };

                const timeStr = formatTime(duration);
                let renderedText = rawText;

                if (rawText.includes('[time]')) {
                    renderedText = rawText.replace(/\[time\]/gi, timeStr);
                } else if (rawText.trim() === "") {
                    renderedText = timeStr;
                } else {
                    renderedText = `${rawText} ${timeStr}`;
                }

                return (
                    <div className="p-4">
                        <div className={cn(
                            "w-full py-4 px-6 border-2 text-center font-bold text-lg transition-all flex items-center justify-center gap-3",
                            contentRadius || "rounded-xl",
                            contentShadow || "shadow-sm",
                            styleClasses[timerStyle as keyof typeof styleClasses] || styleClasses.red
                        )}>
                            <Clock className="h-5 w-5 animate-pulse shrink-0" />
                            <span>{renderedText}</span>
                        </div>
                    </div>
                );
            case 'scheduler':
                return (
                    <div className="p-4">
                        <div className={cn(
                            "w-full bg-card border border-border overflow-hidden flex flex-col",
                            contentRadius || "rounded-xl",
                            contentShadow || "shadow-sm"
                        )}>
                            <div className="p-4 border-b bg-muted/30">
                                <h3 className="font-semibold text-center">{element.content.label || "Agende uma Sessão"}</h3>
                                <p className="text-sm text-center text-muted-foreground">{element.content.description || "Escolha o melhor horário para você."}</p>
                            </div>
                            <div className="p-4 grid grid-cols-1 gap-4 opacity-70 pointer-events-none grayscale-[0.5]">
                                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                                        <div key={i} className="font-medium text-muted-foreground">{d}</div>
                                    ))}
                                    {Array.from({ length: 31 }).map((_, i) => (
                                        <div key={i} className={cn(
                                            "p-1 rounded-full",
                                            i === 14 ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                        )}>{i + 1}</div>
                                    ))}
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold">Horários disponíveis</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].map((t) => (
                                            <div key={t} className="border rounded px-2 py-1 text-xs text-center">{t}</div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'spacer':
                const heightMap = {
                    'small': 'h-4',
                    'medium': 'h-8',
                    'large': 'h-16',
                    'xlarge': 'h-24'
                };
                return (
                    <div className={cn(
                        "w-full border border-dashed border-border rounded-md transition-colors",
                        heightMap[element.content.spacerSize as keyof typeof heightMap] || 'h-8',
                        "group-hover:border-border/80"
                    )} />
                );
            case 'charts':
                const chartType = element.content.chartType || 'cartesian';
                const datasets = element.content.datasets || [
                    { name: "Conjunto A", color: "#64748b", label: "Concorrente", data: [{ label: "Ontem", value: 20 }, { label: "Hoje", value: 40 }, { label: "Amanhã", value: 10 }] },
                    { name: "Conjunto B", color: "#ef4444", label: "Você", data: [{ label: "Ontem", value: 10 }, { label: "Hoje", value: 30 }, { label: "Amanhã", value: 90 }] }
                ];

                const labels = datasets[0]?.data.map(d => d.label) || [];
                const padding = 40;
                const width = 300;
                const height = 180;
                const chartWidth = width - padding * 2;
                const chartHeight = height - padding * 2;

                const renderChart = () => {
                    if (chartType === 'cartesian') {
                        return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                                {/* Grid Lines */}
                                {[0, 25, 50, 75, 100].map(val => {
                                    const y = padding + chartHeight - (val / 100) * chartHeight;
                                    return (
                                        <g key={val}>
                                            <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-border/30" strokeDasharray="4" />
                                            <text x={padding - 10} y={y + 3} className="text-[8px] fill-muted-foreground/60 text-end" textAnchor="end">{val}</text>
                                        </g>
                                    );
                                })}

                                {/* X Axis Labels */}
                                {labels.map((label, i) => {
                                    const x = padding + (i / (labels.length - 1)) * chartWidth;
                                    return (
                                        <text key={i} x={x} y={height - padding + 15} className="text-[8px] fill-muted-foreground/60" textAnchor="middle">{label}</text>
                                    );
                                })}

                                {/* Paths */}
                                {datasets.map((ds, dsIdx) => {
                                    const points = ds.data.map((d, i) => ({
                                        x: padding + (i / (labels.length - 1)) * chartWidth,
                                        y: padding + chartHeight - (d.value / 100) * chartHeight
                                    }));
                                    const dAttr = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                                    return (
                                        <g key={dsIdx}>
                                            <path d={dAttr} fill="none" stroke={ds.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            {points.map((p, i) => (
                                                <circle key={i} cx={p.x} cy={p.y} r="4" fill={ds.color} className="stroke-white stroke-2" />
                                            ))}
                                            {/* Tooltip-like highlights from image */}
                                            {ds.label && points.length > 1 && (
                                                <g transform={`translate(${points[1].x}, ${points[1].y - 20})`}>
                                                    <rect x="-30" y="-10" width="60" height="20" rx="4" fill={ds.color === "#ef4444" ? ds.color : "hsl(var(--muted-foreground))"} />
                                                    <text y="4" textAnchor="middle" className="text-[8px] fill-background font-bold">{ds.label}</text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                        );
                    }

                    if (chartType === 'bar') {
                        return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                                {/* Grid Lines */}
                                {[0, 25, 50, 75, 100].map(val => {
                                    const y = padding + chartHeight - (val / 100) * chartHeight;
                                    return (
                                        <g key={val}>
                                            <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-border/30" strokeDasharray="4" />
                                            <text x={padding - 10} y={y + 3} className="text-[8px] fill-muted-foreground/60 text-end" textAnchor="end">{val}</text>
                                        </g>
                                    );
                                })}

                                {/* Bars */}
                                {labels.map((label, i) => {
                                    const groupWidth = chartWidth / labels.length;
                                    const xBase = padding + i * groupWidth + groupWidth / 2;
                                    const barWidth = 12;

                                    return (
                                        <g key={i}>
                                            <text x={xBase} y={height - padding + 15} className="text-[8px] fill-muted-foreground/60" textAnchor="middle">{label}</text>
                                            {datasets.map((ds, dsIdx) => {
                                                const d = ds.data[i];
                                                const bHeight = (d.value / 100) * chartHeight;
                                                const x = xBase + (dsIdx - (datasets.length - 1) / 2) * (barWidth + 2) - barWidth / 2;
                                                return (
                                                    <rect
                                                        key={dsIdx}
                                                        x={x}
                                                        y={padding + chartHeight - bHeight}
                                                        width={barWidth}
                                                        height={bHeight}
                                                        fill={ds.color}
                                                        rx="2"
                                                    />
                                                );
                                            })}
                                        </g>
                                    );
                                })}
                            </svg>
                        );
                    }

                    if (chartType === 'circular') {
                        const centerX = width / 2;
                        const centerY = height / 2 - 10;
                        const radius = 50;
                        const strokeWidth = 15;

                        return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                                {datasets.map((ds, dsIdx) => {
                                    const dsRadius = radius - dsIdx * (strokeWidth + 5);
                                    let currentAngle = -90;

                                    return ds.data.map((d, i) => {
                                        const angle = (d.value / 100) * 360;
                                        const x1 = centerX + dsRadius * Math.cos(currentAngle * Math.PI / 180);
                                        const y1 = centerY + dsRadius * Math.sin(currentAngle * Math.PI / 180);
                                        currentAngle += angle;
                                        const x2 = centerX + dsRadius * Math.cos(currentAngle * Math.PI / 180);
                                        const y2 = centerY + dsRadius * Math.sin(currentAngle * Math.PI / 180);

                                        const largeArcFlag = angle > 180 ? 1 : 0;
                                        const pathData = `M ${x1} ${y1} A ${dsRadius} ${dsRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

                                        return (
                                            <path
                                                key={i}
                                                d={pathData}
                                                fill="none"
                                                stroke={ds.color}
                                                strokeWidth={strokeWidth}
                                                strokeLinecap="round"
                                            />
                                        );
                                    });
                                })}
                                {/* Labels in circular */}
                                <g transform={`translate(${centerX}, ${height - 30})`}>
                                    {labels.map((l, i) => (
                                        <text
                                            key={i}
                                            x={(i - (labels.length - 1) / 2) * 60}
                                            y="0"
                                            className="text-[8px] fill-slate-400 font-medium"
                                            textAnchor="middle"
                                        >
                                            {l}
                                        </text>
                                    ))}
                                </g>
                            </svg>
                        );
                    }
                };

                return (
                    <div className="p-4">
                        <div className="border border-border rounded-2xl p-4 bg-card shadow-sm overflow-hidden flex items-center justify-center min-h-[220px]">
                            {renderChart()}
                        </div>
                    </div>
                );
            case 'carousel':
                const items = element.content.carouselItems || [
                    { imageUrl: "https://images.unsplash.com/photo-1552053831-71594a27632d", description: "Exemplo de descrição 1" },
                    { imageUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03", description: "Exemplo de descrição 2" }
                ];
                return (
                    <div className="p-4">
                        <div className="relative border border-border rounded-2xl overflow-hidden bg-card shadow-sm group">
                            <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                                {items.map((item, idx) => (
                                    <div key={idx} className="min-w-full flex flex-col">
                                        <div className="aspect-[4/5] bg-muted relative overflow-hidden flex items-center justify-center">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                                            )}
                                        </div>
                                        {element.content.carouselLayout !== 'image-only' && (
                                            <div className="p-4 text-center border-t border-border">
                                                <p className="text-sm text-muted-foreground font-medium">{item.description || "Sem descrição"}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Navigation Arrows */}
                            {items.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setCarouselIndex(prev => (prev > 0 ? prev - 1 : items.length - 1))}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <ChevronLeft className="h-4 w-4 text-foreground" />
                                    </button>
                                    <button
                                        onClick={() => setCarouselIndex(prev => (prev < items.length - 1 ? prev + 1 : 0))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <ChevronRight className="h-4 w-4 text-foreground" />
                                    </button>
                                </>
                            )}

                            {/* Dots */}
                            {element.content.showPagination !== false && items.length > 1 && (
                                <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
                                    {items.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "h-1.5 w-1.5 rounded-full transition-all",
                                                carouselIndex === idx ? "bg-primary w-3" : "bg-muted-foreground/30"
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'metrics':
                return (
                    <div className="p-4">
                        <div className={cn(
                            "grid gap-4",
                            element.content.metricsLayout === 'grid-2' ? "grid-cols-2" :
                                element.content.metricsLayout === 'grid-3' ? "grid-cols-3" :
                                    element.content.metricsLayout === 'grid-4' ? "grid-cols-4" : "grid-cols-1"
                        )}>
                            {(element.content.metrics || [
                                { label: "Fusce vitae tellus in risus sagittis condimentum", value: 30, type: 'bar' },
                                { label: "Fusce vitae tellus in risus sagittis condimentum", value: 30, type: 'bar' }
                            ]).map((metric, idx) => (
                                <div key={idx} className={cn(
                                    "border border-border rounded-2xl p-5 bg-card shadow-sm flex items-center justify-center text-center",
                                    element.content.metricsDisposition === 'legend-graphic' ? "flex-col-reverse" : "flex-col"
                                )}>
                                    <div className="relative h-24 w-10 bg-muted rounded-full flex items-end overflow-hidden mb-3">
                                        <div
                                            className="w-full bg-primary transition-all duration-1000"
                                            style={{ height: `${metric.value}%`, backgroundColor: metric.color || undefined }}
                                        />
                                        <div className="absolute top-2 w-full text-center">
                                            <span className="text-[10px] font-bold text-muted-foreground">{metric.value}%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground leading-snug font-medium">
                                            {metric.label}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'testimonials':
                return (
                    <div className="p-4">
                        <div className={cn(
                            "grid gap-4",
                            element.content.displayType === 'grid' ? "grid-cols-2" : "grid-cols-1",
                            element.content.displayType === 'slide' ? "flex overflow-x-auto pb-4 gap-4 snap-x" : ""
                        )}>
                            {(element.content.testimonials || [
                                { name: "Rafael Nascimento", handle: "@rafael.nascimento", rating: 5, content: "A experiência foi excelente do início ao fim. Atendimento rápido, equipe super atenciosa." },
                                { name: "Camila Ferreira", handle: "@camila.ferreira", rating: 5, content: "Fiquei impressionado com a qualidade e o cuidado em cada detalhe. Superou expectativas." }
                            ]).map((test, idx) => (
                                <div key={idx} className={cn(
                                    "border border-border rounded-2xl p-5 bg-card shadow-sm space-y-3",
                                    element.content.displayType === 'slide' ? "min-w-[85%] snap-center" : ""
                                )}>
                                    <div className="flex gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={cn("h-3 w-3", i < (test.rating || 5) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")} />
                                        ))}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-card-foreground text-sm leading-tight">{test.name}</h4>
                                        {test.handle && <p className="text-[10px] text-muted-foreground leading-snug">{test.handle}</p>}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        {test.content}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'arguments':
                return (
                    <div className="p-4 space-y-4">
                        <div className={cn(
                            "grid gap-3",
                            element.content.layout === '2-col' ? "grid-cols-2" : "grid-cols-1"
                        )}>
                            {(element.content.arguments || [
                                { title: "Fusce vitae", description: "Tellus in risus sagittis condimentum", imageUrl: "" },
                                { title: "Fusce vitae", description: "Tellus in risus sagittis condimentum", imageUrl: "" }
                            ]).map((arg, idx) => (
                                <div key={idx} className="border border-border rounded-2xl p-4 bg-card shadow-sm flex flex-col items-center text-center space-y-3">
                                    <div className="w-full aspect-video bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                                        {arg.imageUrl ? (
                                            <img src={arg.imageUrl} className="w-full h-full object-cover" alt={arg.title} />
                                        ) : (
                                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-card-foreground text-sm leading-tight">{arg.title}</h4>
                                        <p className="text-[10px] text-muted-foreground leading-snug">{arg.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'level':
                return (
                    <div className="p-4 space-y-3 bg-card rounded-2xl border border-border">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-sm font-bold text-card-foreground">{element.content.label || "Nível"}</h4>
                                <p className="text-[10px] text-muted-foreground">{element.content.subtitle || "Subtítulo do nível"}</p>
                            </div>
                            <span className="text-xs font-bold text-muted-foreground">{element.content.percentage || 0}%</span>
                        </div>
                        <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div
                                className="absolute top-0 left-0 h-full bg-primary transition-all duration-500"
                                style={{ width: `${element.content.percentage || 0}%` }}
                            />
                            {/* Knob mockup */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-background border-2 border-primary rounded-full shadow-sm z-10"
                                style={{ left: `calc(${element.content.percentage || 0}% - 8px)` }}
                            />
                        </div>
                        {element.content.legends && (
                            <div className="flex justify-between text-[8px] text-muted-foreground font-medium">
                                {element.content.legends.split(',').map((l, i) => (
                                    <span key={i}>{l.trim()}</span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'yes_no':
                return (
                    <div className="p-4 space-y-4 text-center">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-card-foreground">{element.content.label || "Qual a questão a ser respondida?"}</h3>
                            {element.content.description && (
                                <p className="text-xs text-muted-foreground">{element.content.description}</p>
                            )}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <div className="flex-1 p-3 border border-border rounded-2xl bg-card flex items-center justify-center gap-2 shadow-sm">
                                <span className="flex items-center justify-center h-5 w-5 bg-green-500 rounded text-white italic text-[10px] font-bold">✓</span>
                                <span className="text-sm font-semibold text-card-foreground">Sim</span>
                            </div>
                            <div className="flex-1 p-3 border border-border rounded-2xl bg-card flex items-center justify-center gap-2 shadow-sm">
                                <span className="flex items-center justify-center h-5 w-5 bg-red-500 rounded-full text-white italic text-[10px] font-bold">⊘</span>
                                <span className="text-sm font-semibold text-card-foreground">Não</span>
                            </div>
                        </div>
                    </div>
                );
            case 'faq':
                return (
                    <div className="p-3 space-y-2">
                        <label className="text-sm font-semibold text-card-foreground block mb-2">{element.content.label || "FAQ"}</label>
                        <div className="space-y-2">
                            {(element.content.items || [
                                { question: "Qual o prazo de entrega?", answer: "O prazo médio é de 7 a 15 dias úteis." },
                                { question: "Como funciona a garantia?", answer: "Oferecemos 30 dias de garantia incondicional." }
                            ]).map((item, idx) => (
                                <div key={idx} className="border border-border rounded-lg bg-card overflow-hidden">
                                    <div className="px-4 py-3 flex items-center justify-between bg-muted/50 border-b border-border">
                                        <span className="text-xs font-medium text-foreground">{item.question}</span>
                                        <ChevronRight className="h-3 w-3 text-muted-foreground rotate-90" />
                                    </div>
                                    <div className="px-4 py-3 bg-card">
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">{item.answer}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="p-4 bg-red-50 text-red-500 text-xs text-center">
                        Tipo desconhecido: {element.type}
                    </div>
                );
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={containerStyle}
            className={wrapperClass}
            onClick={(e) => { e.stopPropagation(); onSelect(element.id); }}
        >
            {/* Action Toolbar - Appears above element when selected or hovered */}
            <div className={cn(
                "absolute -top-11 left-0 z-[60] flex items-center bg-blue-600 rounded-lg shadow-xl border border-blue-500 overflow-hidden transition-all duration-200",
                isSelected ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0"
            )}>
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="p-2 hover:bg-blue-700 text-white cursor-grab active:cursor-grabbing border-r border-blue-500/50"
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); onMoveUp?.(element.id); }}
                    className="p-2 hover:bg-blue-700 text-white border-r border-blue-500/50 group/btn transition-colors"
                >
                    <ChevronUp className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onMoveDown?.(element.id); }}
                    className="p-2 hover:bg-blue-700 text-white border-r border-blue-500/50 group/btn transition-colors"
                >
                    <ChevronDown className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onSelect(element.id); }}
                    className="p-2 hover:bg-blue-700 text-white border-r border-blue-500/50 group/btn transition-colors"
                >
                    <Pencil className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onDuplicate?.(element); }}
                    className="p-2 hover:bg-blue-700 text-white border-r border-blue-500/50 group/btn transition-colors"
                >
                    <Copy className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onDelete?.(element.id); }}
                    className="p-2 hover:bg-red-600 text-white group/btn transition-colors"
                >
                    <Trash2 className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                </button>
            </div>

            {renderElementContent()}
        </div>
    );
}

export function QuizBuilderCanvas({
    title,
    description,
    elements,
    selectedElementId,
    onSelectElement,
    onReorderElements,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onDelete,
    previewMode = 'mobile'
}: QuizBuilderCanvasProps) {

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = elements.findIndex(el => el.id === active.id);
            const newIndex = elements.findIndex(el => el.id === over.id);

            const newArray = arrayMove(elements, oldIndex, newIndex);
            onReorderElements(newArray);
        }
    };

    return (
        <div className="flex-1 bg-background/50 flex items-center justify-center p-8 h-full overflow-hidden font-sans">
            <div className={cn(
                "bg-card shadow-2xl transition-all duration-500 ease-in-out relative flex flex-col",
                previewMode === 'mobile'
                    ? "w-[375px] h-[667px] rounded-[3rem] border-8 border-slate-900"
                    : "w-full max-w-5xl h-[85vh] rounded-2xl border border-border"
            )}>
                {/* Notch - Only on Mobile */}
                {previewMode === 'mobile' && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-slate-900 rounded-b-xl z-20"></div>
                )}

                {/* Scrollable Content */}
                <div className={cn(
                    "flex-1 overflow-y-auto scrollbar-hide",
                    previewMode === 'mobile' ? "mt-8 pb-8 px-5" : "mt-0 pb-12 px-12"
                )}>

                    {/* Page Header (Progress Only) */}
                    <div className={cn(
                        "mt-4 text-center mx-auto",
                        previewMode === 'mobile' ? "mb-6 max-w-full" : "mb-10 max-w-2xl pt-10"
                    )}>
                        {/* Progress indicator mock */}
                        <div className="w-full bg-muted h-1 rounded-full mb-2 mx-auto max-w-[80%]">
                            <div className="bg-primary h-1 rounded-full w-1/3"></div>
                        </div>
                    </div>

                    {/* Dynamic Elements */}
                    <div className={cn(
                        "flex flex-wrap gap-y-1 min-h-[200px] mx-auto items-start",
                        previewMode === 'mobile' ? "max-w-full" : "max-w-3xl"
                    )}>
                        {elements.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-xl border-border text-muted-foreground/50">
                                <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <span className="text-xs">Clique em elementos no toolbox<br />para adicionar aqui</span>
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={elements.map(el => el.id)}
                                    strategy={rectSortingStrategy}
                                >
                                    {elements.map((el) => (
                                        <SortableItem
                                            key={el.id}
                                            element={el}
                                            isSelected={selectedElementId === el.id}
                                            onSelect={onSelectElement}
                                            onMoveUp={onMoveUp}
                                            onMoveDown={onMoveDown}
                                            onDuplicate={onDuplicate}
                                            onDelete={onDelete}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        )}

                        {/* Area to click to deselect element and select page */}
                        <div
                            className="h-24 w-full cursor-default"
                            onClick={(e) => { e.stopPropagation(); onSelectElement(""); }}
                        ></div>
                    </div>
                </div>

                {/* Home Indicator - Only on Mobile */}
                {previewMode === 'mobile' && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-900/20 rounded-full"></div>
                )}
            </div>
        </div>
    );
}
