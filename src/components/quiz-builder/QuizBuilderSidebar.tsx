import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, GripVertical, Trash2, MessageSquare, StickyNote, PlayCircle, Image as ImageIcon, MoreVertical, Copy, Eye } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Question = {
    id: string;
    text: string;
    question_type: string | null;
    order: number | null;
};

interface QuizBuilderSidebarProps {
    questions: Question[];
    selectedQuestionId: string | null;
    onSelectQuestion: (id: string) => void;
    onAddQuestion: () => void;
    onDeleteQuestion: (id: string) => void;
    onDuplicateQuestion: (id: string) => void;
    onUpdateQuestionText: (id: string, text: string) => void;
    onReorderQuestions: (questions: Question[]) => void;
    quizSlug: string | undefined;
}

// Componente sortable para cada questão
function SortableQuestionItem({
    question,
    index,
    isSelected,
    isEditing,
    editingText,
    onSelect,
    onStartEditing,
    onSave,
    onKeyDown,
    onEditingTextChange,
    onDelete,
    onDuplicate,
    inputRef,
    quizSlug
}: {
    question: Question;
    index: number;
    isSelected: boolean;
    isEditing: boolean;
    editingText: string;
    onSelect: () => void;
    onStartEditing: (e: React.MouseEvent) => void;
    onSave: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onEditingTextChange: (text: string) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
    quizSlug: string | undefined;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: question.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-md transition-all cursor-pointer border",
                isSelected
                    ? "bg-primary/10 border-primary/20 shadow-sm"
                    : "border-transparent hover:bg-muted/50 hover:border-border"
            )}
        >
            {/* Drag Handle */}
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors p-0.5"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical className="h-4 w-4" />
            </button>

            <span className={cn(
                "text-[10px] font-bold w-4",
                isSelected ? "text-primary" : "text-muted-foreground/50"
            )}>
                {index + 1}
            </span>

            {isEditing ? (
                <input
                    ref={inputRef}
                    value={editingText}
                    onChange={(e) => onEditingTextChange(e.target.value)}
                    onBlur={onSave}
                    onKeyDown={onKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-background border border-primary/30 rounded px-1 py-0.5 text-xs font-medium uppercase outline-none focus:ring-1 focus:ring-primary/30 min-w-[100px]"
                />
            ) : (
                <span
                    onClick={onStartEditing}
                    className={cn(
                        "truncate text-xs font-medium uppercase tracking-tight",
                        isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground transition-colors"
                    )}
                >
                    {question.text || "Sem título"}
                </span>
            )}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all ml-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <div className="px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/40 font-mono border-b mb-1 rounded-t-sm">
                        id: {question.id.substring(0, 8)}
                    </div>
                    {quizSlug && (
                        <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/quiz/${quizSlug}?step_id=${question.id}`, '_blank');
                        }}>
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            Visualizar etapa
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate();
                    }}>
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Duplicar etapa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Excluir etapa
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export function QuizBuilderSidebar({
    questions,
    selectedQuestionId,
    onSelectQuestion,
    onAddQuestion,
    onDeleteQuestion,
    onDuplicateQuestion,
    onUpdateQuestionText,
    onReorderQuestions,
    quizSlug
}: QuizBuilderSidebarProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleStartEditing = (e: React.MouseEvent, question: Question) => {
        e.stopPropagation();
        setEditingId(question.id);
        setEditingText(question.text || "");
        onSelectQuestion(question.id);
    };

    const handleSave = () => {
        if (editingId) {
            onUpdateQuestionText(editingId, editingText);
            setEditingId(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            setEditingId(null);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = questions.findIndex((q) => q.id === active.id);
            const newIndex = questions.findIndex((q) => q.id === over.id);

            const reorderedQuestions = arrayMove(questions, oldIndex, newIndex);
            onReorderQuestions(reorderedQuestions);
        }
    };

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    return (
        <div className="w-64 border-r bg-card flex flex-col h-full">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-card min-h-[49px]">
                <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground/60">Fluxo do Quiz</span>
                <Button
                    onClick={onAddQuestion}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground/40 hover:text-primary hover:bg-primary/5"
                    title="Adicionar Etapa"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={questions.map(q => q.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {questions.map((question, index) => (
                                <SortableQuestionItem
                                    key={question.id}
                                    question={question}
                                    index={index}
                                    isSelected={selectedQuestionId === question.id}
                                    isEditing={editingId === question.id}
                                    editingText={editingText}
                                    onSelect={() => onSelectQuestion(question.id)}
                                    onStartEditing={(e) => handleStartEditing(e, question)}
                                    onSave={handleSave}
                                    onKeyDown={handleKeyDown}
                                    onEditingTextChange={setEditingText}
                                    onDelete={() => onDeleteQuestion(question.id)}
                                    onDuplicate={() => onDuplicateQuestion(question.id)}
                                    inputRef={inputRef}
                                    quizSlug={quizSlug}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>

                    <div className="pt-2 border-t mt-2 border-border/50">
                        <Button
                            onClick={onAddQuestion}
                            variant="ghost"
                            size="sm"
                            className="w-full h-8 text-[10px] font-bold text-blue-500 hover:bg-blue-500/10 hover:text-blue-400 justify-start px-2"
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Em branco
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
