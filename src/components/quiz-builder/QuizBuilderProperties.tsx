import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, GripVertical, Type, Image as ImageIcon, Sparkles, Upload, Smile, Video, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const COMMON_EMOJIS = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
    "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
    "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
    "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗",
    "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯",
    "😦", "😧", "😮", "😲", "😴", "🤤", "😪", "😵", "🤐", "🥴",
    "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿",
    "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖",
    "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
    "🙌", "👏", "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️",
    "🤟", "🤘", "👌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋",
    "🤚", "🖐", "🖖", "👋", "🤙", "💪", "🦾", "🖕", "✍️", "🙏",
    "🦶", "🦵", "🦿", "💄", "💋", "👄", "🦷", "👅", "👂", "🦻",
    "👃", "👣", "👁", "👀", "🧠", "🗣", "👤", "👥", "👶", "👧",
    "🧒", "👦", "👩", "🧑", "👨", "👩‍🦱", "🧑‍🦱", "👨‍🦱", "👩‍🦰", "🧑‍🦰",
    "🔥", "⭐️", "🌟", "✨", "⚡️", "☄️", "💥", "💫", "🌈", "☀️",
    "💎", "💰", "💸", "💵", "💴", "💶", "💷", "💳", "🧳", "👑"
];

const CRM_FIELDS = [
    { label: "Nome do Lead", value: "lead_name" },
    { label: "Email do Lead", value: "lead_email" },
    { label: "Telefone do Lead", value: "lead_phone" },
    { label: "Empresa", value: "lead_company" },
    { label: "Cargo", value: "lead_position" },
    { label: "Instagram", value: "company_instagram" },
    { label: "Site da Empresa", value: "company_website" },
    { label: "Faturamento", value: "company_revenue" },
    { label: "Investimento Ads", value: "company_investment" },
    { label: "Qtd. Funcionários", value: "company_size" },
    { label: "Segmento da Empresa", value: "company_segment" },
    { label: "Outro (Campo Personalizado)", value: "custom" },
];

const MAPABLE_ELEMENTS = ['input', 'email', 'phone', 'single_choice', 'multiple_choice', 'yes_no', 'level'];

const OPERATORS = [
    { label: "Igual a", value: "==" },
    { label: "Diferente de", value: "!=" },
    { label: "Maior que", value: ">" },
    { label: "Menor que", value: "<" },
    { label: "Maior ou igual a", value: ">=" },
    { label: "Menor ou igual a", value: "<=" },
];

// Shared Types
type QuizElement = {
    id: string;
    type: string;
    content: any; // JSONB
    order_index: number;
};

type QuizPage = {
    id: string;
    text: string; // Title
    question_type: string | null;
};

interface QuizBuilderPropertiesProps {
    page: QuizPage | null;
    element: QuizElement | null;
    allPages: QuizPage[];
    onUpdatePage: (updates: Partial<QuizPage>) => void;
    onUpdateElement: (id: string, updates: Partial<QuizElement>) => void;
    onDeleteElement: (id: string) => void;
    onAdjustWithAi?: (element: QuizElement) => void;
    workspaceId?: string;
    quizSettings?: any;
    onUpdateQuizSettings?: (settings: any) => void;
}

export function QuizBuilderProperties({
    page,
    element,
    allPages,
    onUpdatePage,
    onUpdateElement,
    onDeleteElement,
    onAdjustWithAi,
    workspaceId,
    quizSettings,
    onUpdateQuizSettings
}: QuizBuilderPropertiesProps) {

    const { data: closers } = useQuery({
        queryKey: ['workspace-closers', workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];
            console.log("Fetching closers for workspace:", workspaceId);
            const { data, error } = await supabase
                .from('workspace_members')
                .select(`
                    role,
                    user_id,
                    profiles (
                        id,
                        email,
                        full_name,
                        has_google_calendar
                    )
                `)
                .eq('workspace_id', workspaceId);

            if (error) {
                console.error("Error fetching closers:", error);
                throw error;
            }

            console.log("Raw workspace members data:", data);

            const filtered = data
                ?.filter((m: any) => {
                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                    const hasGoogle = (profile as any)?.has_google_calendar;

                    if (!hasGoogle) {
                        console.log(`User ${profile?.full_name || m.user_id} filtered out: no Google Calendar integration found.`);
                    }

                    return hasGoogle;
                })
                .map((m: any) => Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)
                .filter(Boolean) || [];

            console.log("Final closers list:", filtered);
            return filtered;
        },
        enabled: !!workspaceId,
    });

    const [uploadingOptionIdx, setUploadingOptionIdx] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || uploadingOptionIdx === null || !element) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            toast.info("Enviando imagem...");

            // Try to upload to 'quiz-assets', create if needed or use public
            const { error: uploadError } = await supabase.storage
                .from('quiz-assets')
                .upload(filePath, file);

            if (uploadError) {
                console.error("Upload error details:", uploadError);
                throw uploadError;
            }

            const { data } = supabase.storage.from('quiz-assets').getPublicUrl(filePath);

            const newOpts = [...(element.content.options || [])];
            newOpts[uploadingOptionIdx] = {
                ...newOpts[uploadingOptionIdx],
                imageUrl: data.publicUrl
            };
            /* Ensure mediaType is set to 'image' if it wasn't already (though UI handles it) */
            // newOpts[uploadingOptionIdx].mediaType = 'image'; 

            onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });

            toast.success("Imagem enviada!");
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error("Erro ao enviar imagem. Verifique se o bucket 'quiz-assets' existe no Supabase.");
        } finally {
            setUploadingOptionIdx(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // 1. No Selection
    if (!page) {
        return (
            <div className="w-80 border-l bg-background p-6 flex items-center justify-center text-muted-foreground h-full text-center text-sm">
                Selecione uma etapa ou elemento para editar
            </div>
        );
    }

    // 2. Element Selected
    if (element) {
        return (
            <div className="w-80 border-l bg-card flex flex-col h-full overflow-hidden">
                <Tabs defaultValue="component" className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="px-4 py-2 border-b bg-card shrink-0">
                        <TabsList className="grid w-full grid-cols-3 h-8 bg-muted/50">
                            <TabsTrigger value="component" className="text-[10px] font-bold uppercase tracking-tight data-[state=active]:bg-background">Comp.</TabsTrigger>
                            <TabsTrigger value="appearance" className="text-[10px] font-bold uppercase tracking-tight data-[state=active]:bg-background">Apar.</TabsTrigger>
                            <TabsTrigger value="display" className="text-[10px] font-bold uppercase tracking-tight data-[state=active]:bg-background">Exib.</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="component" className="flex-1 min-h-0 overflow-y-auto m-0 p-4 space-y-6 focus-visible:outline-none">
                        <div className="space-y-6 pb-20">
                            {/* IA Adjustment Button */}
                            {onAdjustWithAi && (
                                <Button
                                    className="w-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 h-9 text-xs font-semibold group transition-all"
                                    onClick={() => onAdjustWithAi(element)}
                                >
                                    <Sparkles className="h-3 w-3 mr-2" />
                                    Ajustar elemento com IA
                                </Button>
                            )}

                            {/* Common: Label / Text */}
                            {element.type !== 'spacer' && (
                                <div className="space-y-2">
                                    <Label className="text-xs">Rótulo / Texto</Label>
                                    <Textarea
                                        className="bg-slate-50 min-h-[80px]"
                                        value={element.content.label || ""}
                                        onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, label: e.target.value } })}
                                    />
                                </div>
                            )}

                            {/* CRM Mapping Section */}
                            {MAPABLE_ELEMENTS.includes(element.type) && (
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Conexão com Leads (CRM)</Label>
                                    </div>
                                    <div className="space-y-2">
                                        <Select
                                            value={element.content.crmMapping || "none"}
                                            onValueChange={(value) => onUpdateElement(element.id, { content: { ...element.content, crmMapping: value } })}
                                        >
                                            <SelectTrigger className="bg-slate-50 text-xs h-9 border-slate-200">
                                                <SelectValue placeholder="Vincular com campo do CRM..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Não vincular</SelectItem>
                                                {CRM_FIELDS.map(field => (
                                                    <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {element.content.crmMapping === 'custom' && (
                                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                <Label className="text-[10px] text-slate-400 ml-1">Nome da Tag/Campo personalizado</Label>
                                                <Input
                                                    className="bg-slate-50 h-8 text-xs mt-1 border-slate-200"
                                                    placeholder="Ex: Nicho, Budget..."
                                                    value={element.content.customCrmField || ""}
                                                    onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, customCrmField: e.target.value } })}
                                                />
                                            </div>
                                        )}
                                        <p className="text-[9px] text-slate-400 leading-tight italic px-1">
                                            {element.content.crmMapping && element.content.crmMapping !== 'none'
                                                ? "✓ Este campo irá preencher automaticamente os dados do lead no seu CRM."
                                                : "Este elemento não está enviando dados para o seu CRM."}
                                        </p>
                                    </div>
                                    <Separator className="my-2" />
                                </div>
                            )}

                            {(element.type === 'yes_no') && (
                                <div className="space-y-2">
                                    <Label className="text-xs">Descrição de Ajuda</Label>
                                    <Textarea
                                        className="bg-slate-50 min-h-[60px] text-sm"
                                        value={element.content.description || ""}
                                        placeholder="Texto secundário..."
                                        onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, description: e.target.value } })}
                                    />
                                    <div className="flex items-center justify-between pt-2 border-t mt-4">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-bold">Obrigatório</Label>
                                            <p className="text-[10px] text-muted-foreground">O usuário não poderá avançar sem selecionar.</p>
                                        </div>
                                        <Switch
                                            checked={!!element.content.required}
                                            onCheckedChange={(checked) => onUpdateElement(element.id, { content: { ...element.content, required: checked } })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Input specific */}
                            {(['input', 'email', 'phone'].includes(element.type)) && (
                                <div className="space-y-2">
                                    <Label className="text-xs">Placeholder</Label>
                                    <Input
                                        className="bg-slate-50"
                                        value={element.content.placeholder || ""}
                                        onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, placeholder: e.target.value } })}
                                    />
                                    <div className="flex items-center justify-between pt-2 border-t mt-4">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-bold">Obrigatório</Label>
                                            <p className="text-[10px] text-muted-foreground">O usuário não poderá avançar sem preencher.</p>
                                        </div>
                                        <Switch
                                            checked={!!element.content.required}
                                            onCheckedChange={(checked) => onUpdateElement(element.id, { content: { ...element.content, required: checked } })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Image specific */}
                            {(element.type === 'image') && (
                                <div className="space-y-4">
                                    <Tabs defaultValue={element.content.type || "upload"} className="w-full">
                                        <TabsList className="grid w-full grid-cols-3 h-9 bg-slate-100 p-1">
                                            <TabsTrigger value="upload" className="text-[10px] py-1" onClick={() => onUpdateElement(element.id, { content: { ...element.content, type: 'upload' } })}>Upload</TabsTrigger>
                                            <TabsTrigger value="url" className="text-[10px] py-1" onClick={() => onUpdateElement(element.id, { content: { ...element.content, type: 'url' } })}>URL</TabsTrigger>
                                            <TabsTrigger value="emoji" className="text-[10px] py-1" onClick={() => onUpdateElement(element.id, { content: { ...element.content, type: 'emoji' } })}>Emoji</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="upload" className="mt-4 space-y-4">
                                            <div
                                                className="border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group relative overflow-hidden"
                                                onClick={() => document.getElementById(`image-upload-${element.id}`)?.click()}
                                            >
                                                <input
                                                    id={`image-upload-${element.id}`}
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;

                                                        const promise = new Promise(async (resolve, reject) => {
                                                            try {
                                                                const fileExt = file.name.split('.').pop();
                                                                const fileName = `${Math.random()}.${fileExt}`;
                                                                const filePath = `${fileName}`;

                                                                const { error: uploadError } = await supabase.storage
                                                                    .from('quiz-assets')
                                                                    .upload(filePath, file);

                                                                if (uploadError) throw uploadError;

                                                                const { data: { publicUrl } } = supabase.storage
                                                                    .from('quiz-assets')
                                                                    .getPublicUrl(filePath);

                                                                onUpdateElement(element.id, { content: { ...element.content, url: publicUrl, type: 'upload' } });
                                                                resolve(publicUrl);
                                                            } catch (err) {
                                                                reject(err);
                                                            }
                                                        });

                                                        toast.promise(promise, {
                                                            loading: 'Enviando imagem...',
                                                            success: 'Imagem enviada com sucesso!',
                                                            error: 'Erro ao enviar imagem'
                                                        });
                                                    }}
                                                />
                                                <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-500">
                                                    <Upload className="h-8 w-8" />
                                                    <span className="text-[11px] font-medium">Clique para selecionar</span>
                                                </div>
                                            </div>
                                            {element.content.url && element.content.type === 'upload' && (
                                                <div className="relative group rounded-xl border overflow-hidden">
                                                    <img src={element.content.url} className="w-full h-auto max-h-40 object-contain bg-slate-50" alt="Preview" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                                        <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={(e) => {
                                                            e.stopPropagation();
                                                            onUpdateElement(element.id, { content: { ...element.content, url: "" } });
                                                        }}>Remover</Button>
                                                    </div>
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="url" className="mt-4 space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">URL da Imagem</Label>
                                                <Input
                                                    className="bg-slate-50 h-10"
                                                    value={element.content.url || ""}
                                                    placeholder="https://exemplo.com/imagem.png"
                                                    onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, url: e.target.value, type: 'url' } })}
                                                />
                                            </div>
                                            {element.content.url && element.content.type === 'url' && (
                                                <div className="rounded-xl border overflow-hidden bg-slate-50">
                                                    <img src={element.content.url} className="w-full h-auto max-h-40 object-contain" alt="Preview" />
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="emoji" className="mt-4">
                                            <div className="grid grid-cols-4 gap-2">
                                                {["✨", "🔥", "🚀", "💡", "🎯", "💎", "⭐", "✅", "🎉", "❤️", "🎁", "🧠", "💪", "🌈", "🦋", "🦄", "🚨", "🔔", "💰", "📉", "📈", "🤫", "🤔", "🤩"].map((emoji) => (
                                                    <button
                                                        key={emoji}
                                                        className={cn(
                                                            "h-12 flex items-center justify-center text-2xl rounded-lg hover:bg-slate-100 transition-all border border-transparent",
                                                            element.content.emoji === emoji && "bg-blue-50 border-blue-200"
                                                        )}
                                                        onClick={() => onUpdateElement(element.id, { content: { ...element.content, emoji, type: 'emoji' } })}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            )}

                            {/* Choice specific (Initial Manual Implementation) */}
                            {(['single_choice', 'multiple_choice'].includes(element.type)) && (
                                <div className="space-y-3">
                                    <Label className="text-xs">Opções</Label>
                                    <div className="space-y-2">
                                        {(element.content.options || []).map((opt: any, idx: number) => (
                                            <div key={idx} className="flex flex-col gap-2 w-full p-2 border border-slate-100 rounded-lg bg-white/50 mb-2">
                                                <div className="flex gap-2">
                                                    <Input
                                                        className="h-8 text-sm flex-1"
                                                        value={opt.label}
                                                        placeholder="Rótulo"
                                                        onChange={(e) => {
                                                            const newOpts = [...(element.content.options || [])];
                                                            newOpts[idx] = { ...newOpts[idx], label: e.target.value, value: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                        }}
                                                    />
                                                    <Input
                                                        className="h-8 text-sm w-16 bg-slate-50"
                                                        type="number"
                                                        placeholder="Pts"
                                                        value={opt.points || 0}
                                                        onChange={(e) => {
                                                            const newOpts = [...(element.content.options || [])];
                                                            newOpts[idx] = { ...newOpts[idx], points: parseInt(e.target.value) || 0 };
                                                            onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                        }}
                                                    />
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                        onClick={() => {
                                                            const newOpts = (element.content.options || []).filter((_: any, i: number) => i !== idx);
                                                            onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                {/* Destino */}
                                                <div className="flex items-center gap-2 pl-1">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap w-12">Destino:</span>
                                                    <Select
                                                        value={opt.destinationPageId || "next"}
                                                        onValueChange={(value) => {
                                                            const newOpts = [...(element.content.options || [])];
                                                            newOpts[idx] = { ...newOpts[idx], destinationPageId: value };
                                                            onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-7 text-[10px] bg-slate-50/50 border-slate-100 flex-1">
                                                            <SelectValue placeholder="Próxima etapa" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="next">Próxima etapa (padrão)</SelectItem>
                                                            <SelectItem value="submit">Finalizar Quiz</SelectItem>
                                                            <Separator className="my-1" />
                                                            {allPages.map((p, pIdx) => (
                                                                <SelectItem key={p.id} value={p.id}>
                                                                    Etapa {pIdx + 1}: {p.text}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Pixel Event for Option */}
                                                <div className="flex items-center gap-2 pl-1">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap w-12">Pixel:</span>
                                                    <Input
                                                        className="h-7 text-[10px] bg-slate-50/50 border-slate-100 flex-1 placeholder:text-slate-300"
                                                        placeholder="Evento (ex: Lead)"
                                                        value={opt.pixelEvent || ""}
                                                        onChange={(e) => {
                                                            const newOpts = [...(element.content.options || [])];
                                                            newOpts[idx] = { ...newOpts[idx], pixelEvent: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                        }}
                                                    />
                                                </div>
                                                {/* Mídia Selector */}
                                                <div className="flex items-center gap-2 pl-1">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap w-12">Mídia:</span>
                                                    <div className="flex bg-slate-100 rounded-md p-0.5 gap-0.5 shrink-0">
                                                        <Button
                                                            variant={(!opt.mediaType || opt.mediaType === 'none') ? "secondary" : "ghost"}
                                                            size="icon" className={cn("h-6 w-6 rounded", (!opt.mediaType || opt.mediaType === 'none') && "shadow-sm bg-white")}
                                                            onClick={() => {
                                                                const newOpts = [...(element.content.options || [])];
                                                                newOpts[idx] = { ...newOpts[idx], mediaType: 'none' };
                                                                onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                            }}
                                                            title="Sem Mídia"
                                                        >
                                                            <Type className="h-3 w-3 text-slate-500" />
                                                        </Button>
                                                        <Button
                                                            variant={opt.mediaType === 'image' ? "secondary" : "ghost"}
                                                            size="icon" className={cn("h-6 w-6 rounded", opt.mediaType === 'image' && "shadow-sm bg-white")}
                                                            onClick={() => {
                                                                const newOpts = [...(element.content.options || [])];
                                                                newOpts[idx] = { ...newOpts[idx], mediaType: 'image' };
                                                                onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                            }}
                                                            title="Imagem"
                                                        >
                                                            <ImageIcon className="h-3 w-3 text-slate-500" />
                                                        </Button>
                                                        <Button
                                                            variant={opt.mediaType === 'emoji' ? "secondary" : "ghost"}
                                                            size="icon" className={cn("h-6 w-6 rounded", opt.mediaType === 'emoji' && "shadow-sm bg-white")}
                                                            onClick={() => {
                                                                const newOpts = [...(element.content.options || [])];
                                                                newOpts[idx] = { ...newOpts[idx], mediaType: 'emoji' };
                                                                onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                            }}
                                                            title="Emoji"
                                                        >
                                                            <Smile className="h-3 w-3 text-slate-500" />
                                                        </Button>
                                                    </div>

                                                    {/* Media Controls */}
                                                    {opt.mediaType === 'image' && (
                                                        <div className="flex-1 flex justify-end">
                                                            {opt.imageUrl ? (
                                                                <div className="relative group/img h-7 w-7">
                                                                    <img src={opt.imageUrl} className="h-7 w-7 rounded object-cover border bg-slate-50" alt="Option" />
                                                                    <button
                                                                        className="absolute -top-1 -right-1 bg-red-100 text-red-500 rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-sm border border-red-200"
                                                                        onClick={() => {
                                                                            const newOpts = [...(element.content.options || [])];
                                                                            newOpts[idx] = { ...newOpts[idx], imageUrl: '' };
                                                                            onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-2 w-2" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <Button
                                                                    variant="outline" size="sm" className="h-7 text-[10px] w-full border-dashed"
                                                                    onClick={() => {
                                                                        setUploadingOptionIdx(idx);
                                                                        fileInputRef.current?.click();
                                                                    }}
                                                                >
                                                                    <Upload className="h-3 w-3 mr-1" /> Imagem
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {opt.mediaType === 'emoji' && (
                                                        <div className="flex-1">
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant="outline" className="h-7 w-full text-xs justify-start px-2 bg-slate-50 border-dashed text-slate-500 hover:text-slate-700">
                                                                        {opt.emoji || "Selecionar Emoji..."}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-64 p-2">
                                                                    <ScrollArea className="h-64">
                                                                        <div className="grid grid-cols-6 gap-1">
                                                                            {COMMON_EMOJIS.map((emoji) => (
                                                                                <button
                                                                                    key={emoji}
                                                                                    className="h-8 w-8 text-lg hover:bg-slate-100 rounded flex items-center justify-center transition-colors"
                                                                                    onClick={() => {
                                                                                        const newOpts = [...(element.content.options || [])];
                                                                                        newOpts[idx] = { ...newOpts[idx], emoji };
                                                                                        onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                                                                    }}
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </ScrollArea>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline" size="sm" className="w-full text-xs"
                                            onClick={() => {
                                                const newOpts = [...(element.content.options || []), { label: "Nova Opção", value: "new" }];
                                                onUpdateElement(element.id, { content: { ...element.content, options: newOpts } });
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-2" /> Adicionar Opção
                                        </Button>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t mt-4">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-bold">Obrigatório</Label>
                                            <p className="text-[10px] text-muted-foreground">O usuário não poderá avançar sem selecionar.</p>
                                        </div>
                                        <Switch
                                            checked={!!element.content.required}
                                            onCheckedChange={(checked) => onUpdateElement(element.id, { content: { ...element.content, required: checked } })}
                                        />
                                    </div>
                                </div>
                            )}


                            {/* Button specific */}
                            {(element.type === 'button') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Texto do Botão</Label>
                                        <Input
                                            className="bg-slate-50"
                                            value={element.content.buttonText || element.content.label || "Continuar"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, buttonText: e.target.value, label: e.target.value } })}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-slate-400">Rastreamento (Pixel)</Label>
                                        <Input
                                            className="bg-slate-50 border-orange-200 focus:border-orange-500"
                                            placeholder="Ex: Lead, Purchase, ou ID Personalizado"
                                            value={element.content.pixelEvent || ""}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, pixelEvent: e.target.value } })}
                                        />
                                        <p className="text-[10px] text-slate-400 italic">
                                            Nome do evento (Standard) ou Código (Custom) para enviar ao Meta Pixel ao clicar.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-slate-400">Ação do Botão</Label>
                                        <select
                                            className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2"
                                            value={element.content.actionType || "next"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, actionType: e.target.value } })}
                                        >
                                            <option value="next">Avançar para próxima etapa</option>
                                            <option value="goto">Ir para etapa específica</option>
                                            <option value="external">Redirecionar para link externo</option>
                                            <option value="submit">Finalizar e enviar quiz</option>
                                        </select>
                                    </div>

                                    {element.content.actionType === 'goto' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs">Etapa de Destino</Label>
                                            <Select
                                                value={element.content.destinationPageId || ""}
                                                onValueChange={(value) => onUpdateElement(element.id, { content: { ...element.content, destinationPageId: value } })}
                                            >
                                                <SelectTrigger className="bg-slate-50">
                                                    <SelectValue placeholder="Selecione a etapa..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allPages.map((p, pIdx) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            Etapa {pIdx + 1}: {p.text}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] text-slate-400 italic">
                                                Selecione para qual etapa o usuário será levado ao clicar no botão
                                            </p>
                                        </div>
                                    )}

                                    {element.content.actionType === 'submit' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs">URL de Redirecionamento (Opcional)</Label>
                                            <Input
                                                type="url"
                                                className="bg-slate-50"
                                                placeholder="https://suapagina.com/obrigado"
                                                value={element.content.submitRedirectUrl || ""}
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, submitRedirectUrl: e.target.value } })}
                                            />
                                            <p className="text-[10px] text-slate-400 italic font-medium">
                                                Se preenchido, o usuário será redirecionado para esta página após o envio das respostas.
                                            </p>
                                        </div>
                                    )}

                                    {element.content.actionType === 'external' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs">URL de Destino</Label>
                                            <Input
                                                type="url"
                                                className="bg-slate-50"
                                                placeholder="https://exemplo.com"
                                                value={element.content.externalUrl || ""}
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, externalUrl: e.target.value } })}
                                            />
                                            <div className="flex items-center gap-2 pt-1">
                                                <input
                                                    type="checkbox"
                                                    id="openNewTab"
                                                    className="h-4 w-4 rounded border-slate-300"
                                                    checked={element.content.openInNewTab || false}
                                                    onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, openInNewTab: e.target.checked } })}
                                                />
                                                <Label htmlFor="openNewTab" className="text-xs text-slate-600 cursor-pointer">
                                                    Abrir em nova aba
                                                </Label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}


                            {/* Level specific */}
                            {(element.type === 'level') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Subtítulo</Label>
                                        <Input
                                            className="bg-slate-50"
                                            value={element.content.subtitle || ""}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, subtitle: e.target.value } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Porcentagem ({element.content.percentage || 0}%)</Label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                            value={element.content.percentage || 0}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, percentage: parseInt(e.target.value) } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Legendas (separe por vírgula)</Label>
                                        <Input
                                            className="bg-slate-50"
                                            placeholder="Ex: Normal, Médio, Muito"
                                            value={element.content.legends || ""}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, legends: e.target.value } })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Arguments specific */}
                            {(element.type === 'arguments') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Layout</Label>
                                        <select
                                            className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2"
                                            value={element.content.layout || "2-col"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, layout: e.target.value as any } })}
                                        >
                                            <option value="1-col">1 Coluna</option>
                                            <option value="2-col">2 Colunas</option>
                                        </select>
                                    </div>

                                    <Separator />

                                    <Label className="text-xs">Argumentos</Label>
                                    <div className="space-y-4">
                                        {(element.content.arguments || []).map((arg: any, idx: number) => (
                                            <div key={idx} className="p-3 border rounded-lg space-y-3 bg-slate-50/50 relative group">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-slate-400">Título</Label>
                                                    <Input
                                                        className="h-8 text-sm bg-background"
                                                        value={arg.title}
                                                        onChange={(e) => {
                                                            const newArgs = [...(element.content.arguments || [])];
                                                            newArgs[idx] = { ...newArgs[idx], title: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, arguments: newArgs } });
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-slate-400">Descrição</Label>
                                                    <Input
                                                        className="h-8 text-sm bg-background"
                                                        value={arg.description}
                                                        onChange={(e) => {
                                                            const newArgs = [...(element.content.arguments || [])];
                                                            newArgs[idx] = { ...newArgs[idx], description: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, arguments: newArgs } });
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-slate-400">URL da Imagem</Label>
                                                    <Input
                                                        className="h-8 text-sm bg-background"
                                                        value={arg.imageUrl}
                                                        placeholder="https://..."
                                                        onChange={(e) => {
                                                            const newArgs = [...(element.content.arguments || [])];
                                                            newArgs[idx] = { ...newArgs[idx], imageUrl: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, arguments: newArgs } });
                                                        }}
                                                    />
                                                </div>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border shadow-sm text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        const newArgs = (element.content.arguments || []).filter((_: any, i: number) => i !== idx);
                                                        onUpdateElement(element.id, { content: { ...element.content, arguments: newArgs } });
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline" size="sm" className="w-full text-xs dashed border-2 border-dashed"
                                            onClick={() => {
                                                const newArgs = [...(element.content.arguments || []), { title: "Novo Argumento", description: "Descrição aqui", imageUrl: "" }];
                                                onUpdateElement(element.id, { content: { ...element.content, arguments: newArgs } });
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-2" /> Adicionar Argumento
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Price specific */}
                            {(element.type === 'price') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Título (Plano)</Label>
                                        <Input
                                            className="bg-slate-50"
                                            value={element.content.label || ""}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, label: e.target.value } })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase text-slate-400">Prefixo</Label>
                                            <Input
                                                className="h-8 text-sm bg-slate-50"
                                                value={element.content.prefix || ""}
                                                placeholder="10% off"
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, prefix: e.target.value } })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase text-slate-400">Valor</Label>
                                            <Input
                                                className="h-8 text-sm bg-slate-50 font-bold"
                                                value={element.content.value || ""}
                                                placeholder="89,90"
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, value: e.target.value } })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase text-slate-400">Sufixo</Label>
                                            <Input
                                                className="h-8 text-sm bg-slate-50"
                                                value={element.content.suffix || ""}
                                                placeholder="à vista"
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, suffix: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Texto Destaque (Preto)</Label>
                                        <Input
                                            className="bg-slate-50 uppercase font-medium text-xs"
                                            value={element.content.highlightText || ""}
                                            placeholder="TEXTO EM DESTAQUE"
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, highlightText: e.target.value } })}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label className="text-xs">Tipo de preço</Label>
                                        <select className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2">
                                            <option>Redirecionar</option>
                                            <option>Apenas Exibição</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Destino do redirecionamento</Label>
                                        <Input
                                            className="bg-slate-50"
                                            value={element.content.redirectUrl || ""}
                                            placeholder="https://..."
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, redirectUrl: e.target.value } })}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs text-slate-600">Redirecionar ao clicar</Label>
                                            <input
                                                type="checkbox"
                                                checked={element.content.shouldRedirect}
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, shouldRedirect: e.target.checked } })}
                                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs text-slate-600">Habilitar checkbox</Label>
                                            <input
                                                type="checkbox"
                                                checked={element.content.hasCheckbox}
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, hasCheckbox: e.target.checked } })}
                                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Testimonials specific */}
                            {(element.type === 'testimonials') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Tipo</Label>
                                        <select
                                            className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2"
                                            value={element.content.displayType || "list"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, displayType: e.target.value as any } })}
                                        >
                                            <option value="list">Lista</option>
                                            <option value="slide">Slide</option>
                                            <option value="grid">Grade</option>
                                        </select>
                                    </div>

                                    <Separator />

                                    <Label className="text-xs">Depoimentos</Label>
                                    <div className="space-y-4">
                                        {(element.content.testimonials || []).map((test: any, idx: number) => (
                                            <div key={idx} className="p-3 border rounded-lg space-y-3 bg-slate-50/50 relative group">
                                                <div className="flex gap-2">
                                                    <div className="w-10 h-10 bg-white border rounded-md flex items-center justify-center shrink-0">
                                                        <ImageIcon className="h-5 w-5 text-slate-200" />
                                                    </div>
                                                    <Input
                                                        className="h-10 text-sm bg-background"
                                                        value={test.name}
                                                        placeholder="Nome"
                                                        onChange={(e) => {
                                                            const newTests = [...(element.content.testimonials || [])];
                                                            newTests[idx] = { ...newTests[idx], name: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, testimonials: newTests } });
                                                        }}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Input
                                                        className="h-8 text-[11px] bg-background"
                                                        value={test.handle}
                                                        placeholder="@usuario"
                                                        onChange={(e) => {
                                                            const newTests = [...(element.content.testimonials || [])];
                                                            newTests[idx] = { ...newTests[idx], handle: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, testimonials: newTests } });
                                                        }}
                                                    />
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-[11px] bg-background"
                                                        value={test.rating}
                                                        min="1" max="5"
                                                        onChange={(e) => {
                                                            const newTests = [...(element.content.testimonials || [])];
                                                            newTests[idx] = { ...newTests[idx], rating: parseInt(e.target.value) };
                                                            onUpdateElement(element.id, { content: { ...element.content, testimonials: newTests } });
                                                        }}
                                                    />
                                                </div>
                                                <Textarea
                                                    className="text-xs bg-background min-h-[60px]"
                                                    value={test.content}
                                                    placeholder="Depoimento..."
                                                    onChange={(e) => {
                                                        const newTests = [...(element.content.testimonials || [])];
                                                        newTests[idx] = { ...newTests[idx], content: e.target.value };
                                                        onUpdateElement(element.id, { content: { ...element.content, testimonials: newTests } });
                                                    }}
                                                />
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border shadow-sm text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        const newTests = (element.content.testimonials || []).filter((_: any, i: number) => i !== idx);
                                                        onUpdateElement(element.id, { content: { ...element.content, testimonials: newTests } });
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline" size="sm" className="w-full text-xs font-medium"
                                            onClick={() => {
                                                const newTests = [...(element.content.testimonials || []), { name: "Novo Cliente", handle: "@usuario", rating: 5, content: "Sua experiência aqui..." }];
                                                onUpdateElement(element.id, { content: { ...element.content, testimonials: newTests } });
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-2" /> adicionar depoimento
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Before/After specific */}
                            {(element.type === 'before_after') && (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <Label className="text-[11px] uppercase text-slate-400 font-bold">Primeira imagem</Label>
                                        <div className="space-y-2">
                                            <div className="flex bg-slate-100 p-1 rounded-md">
                                                <Button variant="ghost" size="sm" className="flex-1 text-[10px] h-7 bg-white shadow-sm">Imagem</Button>
                                                <Button variant="ghost" size="sm" className="flex-1 text-[10px] h-7">URL</Button>
                                            </div>
                                            <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                                {element.content.beforeImageUrl ? (
                                                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white border">
                                                        <img src={element.content.beforeImageUrl} className="w-full h-full object-cover" alt="Antes" />
                                                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center transition-all opacity-0 hover:opacity-100">
                                                            <Button size="sm" variant="secondary" className="h-7 text-[10px]">Alterar</Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <ImageIcon className="h-6 w-6 text-slate-300 mb-2" />
                                                        <span className="text-[10px] text-slate-500">Selecionar imagem</span>
                                                    </>
                                                )}
                                            </div>
                                            <Input
                                                className="h-8 text-[11px] bg-slate-50"
                                                value={element.content.beforeImageUrl || ""}
                                                placeholder="URL da imagem (antes)..."
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, beforeImageUrl: e.target.value } })}
                                            />
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-3">
                                        <Label className="text-[11px] uppercase text-slate-400 font-bold">Segunda imagem</Label>
                                        <div className="space-y-2">
                                            <div className="flex bg-slate-100 p-1 rounded-md">
                                                <Button variant="ghost" size="sm" className="flex-1 text-[10px] h-7 bg-white shadow-sm">Imagem</Button>
                                                <Button variant="ghost" size="sm" className="flex-1 text-[10px] h-7">URL</Button>
                                            </div>
                                            <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                                {element.content.afterImageUrl ? (
                                                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white border">
                                                        <img src={element.content.afterImageUrl} className="w-full h-full object-cover" alt="Depois" />
                                                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center transition-all opacity-0 hover:opacity-100">
                                                            <Button size="sm" variant="secondary" className="h-7 text-[10px]">Alterar</Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <ImageIcon className="h-6 w-6 text-slate-300 mb-2" />
                                                        <span className="text-[10px] text-slate-500">Selecionar imagem</span>
                                                    </>
                                                )}
                                            </div>
                                            <Input
                                                className="h-8 text-[11px] bg-slate-50"
                                                value={element.content.afterImageUrl || ""}
                                                placeholder="URL da imagem (depois)..."
                                                onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, afterImageUrl: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Metrics specific */}
                            {(element.type === 'metrics') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Layout</Label>
                                        <select
                                            className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2"
                                            value={element.content.metricsLayout || "grid-2"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, metricsLayout: e.target.value as any } })}
                                        >
                                            <option value="list">Itens em lista</option>
                                            <option value="grid-2">Grade de 2 colunas</option>
                                            <option value="grid-3">Grade de 3 colunas</option>
                                            <option value="grid-4">Grade de 4 colunas</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs">Disposição</Label>
                                        <select
                                            className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2"
                                            value={element.content.metricsDisposition || "graphic-legend"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, metricsDisposition: e.target.value as any } })}
                                        >
                                            <option value="graphic-legend">gráfico | legenda</option>
                                            <option value="legend-graphic">legenda | gráfico</option>
                                        </select>
                                    </div>

                                    <Separator />

                                    <Label className="text-xs">Gráficos</Label>
                                    <div className="space-y-4">
                                        {(element.content.metrics || []).map((metric: any, idx: number) => (
                                            <div key={idx} className="p-3 border rounded-lg space-y-3 bg-slate-50/50 relative group">
                                                <div className="flex gap-2">
                                                    <div className="h-8 bg-white border rounded flex items-center px-2 text-[10px] font-medium text-slate-500 min-w-[60px] justify-center">
                                                        {metric.type === 'bar' ? 'Barra' : 'Círculo'}
                                                    </div>
                                                    <div className="h-8 w-full bg-white border rounded flex items-center px-2 text-[10px] font-medium text-slate-500">
                                                        Cor tema
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        className="h-8 w-20 text-sm bg-background"
                                                        value={metric.value}
                                                        onChange={(e) => {
                                                            const newMetrics = [...(element.content.metrics || [])];
                                                            newMetrics[idx] = { ...newMetrics[idx], value: parseInt(e.target.value) };
                                                            onUpdateElement(element.id, { content: { ...element.content, metrics: newMetrics } });
                                                        }}
                                                    />
                                                </div>
                                                <Textarea
                                                    className="text-xs bg-background min-h-[60px]"
                                                    value={metric.label || ""}
                                                    placeholder="Legenda..."
                                                    onChange={(e) => {
                                                        const newMetrics = [...(element.content.metrics || [])];
                                                        newMetrics[idx] = { ...newMetrics[idx], label: e.target.value };
                                                        onUpdateElement(element.id, { content: { ...element.content, metrics: newMetrics } });
                                                    }}
                                                />
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border shadow-sm text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        const newMetrics = (element.content.metrics || []).filter((_: any, i: number) => i !== idx);
                                                        onUpdateElement(element.id, { content: { ...element.content, metrics: newMetrics } });
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline" size="sm" className="w-full text-xs font-medium"
                                            onClick={() => {
                                                const newMetrics = [...(element.content.metrics || []), { label: "Nova legenda aqui", value: 50, type: 'bar' }];
                                                onUpdateElement(element.id, { content: { ...element.content, metrics: newMetrics } });
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-2" /> adicionar gráfico
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Spacer specific */}
                            {(element.type === 'spacer') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Tamanho do espaço</Label>
                                        <select
                                            className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2"
                                            value={element.content.spacerSize || "medium"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, spacerSize: e.target.value as any } })}
                                        >
                                            <option value="small">small</option>
                                            <option value="medium">medium</option>
                                            <option value="large">large</option>
                                            <option value="xlarge">xlarge</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Charts specific */}
                            {(element.type === 'charts') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Tipo de gráfico</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['cartesian', 'bar', 'circular'] as const).map((type) => (
                                                <Button
                                                    key={type}
                                                    variant="outline"
                                                    className={cn(
                                                        "h-14 flex flex-col items-center justify-center gap-1 text-[10px]",
                                                        (element.content.chartType || 'cartesian') === type ? "border-blue-500 bg-blue-50 text-blue-600" : ""
                                                    )}
                                                    onClick={() => onUpdateElement(element.id, { content: { ...element.content, chartType: type } })}
                                                >
                                                    <div className="capitalize">{type === 'cartesian' ? 'Cartesiano' : type === 'bar' ? 'Barra' : 'Circular'}</div>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Conjuntos de dados</Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[10px] text-blue-600"
                                                onClick={() => {
                                                    const newDatasets = [...(element.content.datasets || [])];
                                                    newDatasets.push({
                                                        name: `Conjunto ${String.fromCharCode(65 + newDatasets.length)}`,
                                                        color: "#64748b",
                                                        data: (newDatasets[0]?.data || []).map((d: any) => ({ label: d.label, value: 0 }))
                                                    });
                                                    onUpdateElement(element.id, { content: { ...element.content, datasets: newDatasets, activeDatasetIndex: newDatasets.length - 1 } });
                                                }}
                                            >
                                                + Novo
                                            </Button>
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                            {(element.content.datasets || []).map((ds: any, idx: number) => (
                                                <Button
                                                    key={idx}
                                                    variant="outline"
                                                    className={cn(
                                                        "h-8 px-3 text-[10px] shrink-0",
                                                        (element.content.activeDatasetIndex || 0) === idx ? "border-blue-500 bg-blue-50 text-blue-600" : ""
                                                    )}
                                                    onClick={() => onUpdateElement(element.id, { content: { ...element.content, activeDatasetIndex: idx } })}
                                                >
                                                    {ds.name}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Active Dataset Data */}
                                    {((element.content.datasets || [])[element.content.activeDatasetIndex || 0]) && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px]">Nome do conjunto</Label>
                                                    <Input
                                                        className="h-8 text-sm"
                                                        value={(element.content.datasets || [])[element.content.activeDatasetIndex || 0]?.name}
                                                        onChange={(e) => {
                                                            const newDatasets = [...(element.content.datasets || [])];
                                                            const idx = element.content.activeDatasetIndex || 0;
                                                            newDatasets[idx] = { ...newDatasets[idx], name: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, datasets: newDatasets } });
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px]">Legenda destaque</Label>
                                                    <Input
                                                        className="h-8 text-sm"
                                                        placeholder="Ex: Você"
                                                        value={(element.content.datasets || [])[element.content.activeDatasetIndex || 0]?.label || ""}
                                                        onChange={(e) => {
                                                            const newDatasets = [...(element.content.datasets || [])];
                                                            const idx = element.content.activeDatasetIndex || 0;
                                                            newDatasets[idx] = { ...newDatasets[idx], label: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, datasets: newDatasets } });
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">Dados do conjunto</Label>
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-[1fr,60px,32px] gap-2 px-1">
                                                        <span className="text-[10px] text-slate-400">Legenda</span>
                                                        <span className="text-[10px] text-slate-400">Valor</span>
                                                        <span />
                                                    </div>
                                                    {((element.content.datasets || [])[element.content.activeDatasetIndex || 0]?.data || []).map((point: any, pIdx: number) => (
                                                        <div key={pIdx} className="flex gap-2 items-center group">
                                                            <Input
                                                                className="h-8 text-sm"
                                                                value={point.label}
                                                                onChange={(e) => {
                                                                    const newDatasets = [...(element.content.datasets || [])];
                                                                    const dsIdx = element.content.activeDatasetIndex || 0;
                                                                    const newData = [...newDatasets[dsIdx].data];
                                                                    newData[pIdx] = { ...newData[pIdx], label: e.target.value };
                                                                    // Update all datasets to keep labels in sync
                                                                    newDatasets.forEach((ds, idx) => {
                                                                        const d = [...ds.data];
                                                                        if (d[pIdx]) d[pIdx].label = e.target.value;
                                                                        newDatasets[idx].data = d;
                                                                    });
                                                                    onUpdateElement(element.id, { content: { ...element.content, datasets: newDatasets } });
                                                                }}
                                                            />
                                                            <Input
                                                                type="number"
                                                                className="h-8 w-[60px] text-sm"
                                                                value={point.value}
                                                                onChange={(e) => {
                                                                    const newDatasets = [...(element.content.datasets || [])];
                                                                    const dsIdx = element.content.activeDatasetIndex || 0;
                                                                    const newData = [...newDatasets[dsIdx].data];
                                                                    newData[pIdx] = { ...newData[pIdx], value: parseInt(e.target.value) };
                                                                    newDatasets[dsIdx].data = newData;
                                                                    onUpdateElement(element.id, { content: { ...element.content, datasets: newDatasets } });
                                                                }}
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100"
                                                                onClick={() => {
                                                                    const newDatasets = [...(element.content.datasets || [])];
                                                                    newDatasets.forEach((ds, idx) => {
                                                                        newDatasets[idx].data = ds.data.filter((_: any, i: number) => i !== pIdx);
                                                                    });
                                                                    onUpdateElement(element.id, { content: { ...element.content, datasets: newDatasets } });
                                                                }}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full h-8 text-[11px]"
                                                        onClick={() => {
                                                            const newDatasets = [...(element.content.datasets || [])];
                                                            newDatasets.forEach((ds, idx) => {
                                                                const newData = [...ds.data];
                                                                newData.push({ label: "Novo", value: 0 });
                                                                newDatasets[idx].data = newData;
                                                            });
                                                            onUpdateElement(element.id, { content: { ...element.content, datasets: newDatasets } });
                                                        }}
                                                    >
                                                        + Adicionar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Carousel specific */}
                            {(element.type === 'carousel') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Layout</Label>
                                        <select
                                            className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2"
                                            value={element.content.carouselLayout || "image-text"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, carouselLayout: e.target.value as any } })}
                                        >
                                            <option value="image-text">Imagem e Texto</option>
                                            <option value="image-only">Somente Imagem</option>
                                        </select>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "h-4 w-8 rounded-full transition-colors relative cursor-pointer",
                                                    element.content.showPagination !== false ? "bg-blue-500" : "bg-slate-200"
                                                )} onClick={() => onUpdateElement(element.id, { content: { ...element.content, showPagination: element.content.showPagination === false ? true : false } })}>
                                                    <div className={cn(
                                                        "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                                                        element.content.showPagination !== false ? "left-4.5" : "left-0.5"
                                                    )} />
                                                </div>
                                                <Label className="text-xs font-normal">Paginação</Label>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "h-4 w-8 rounded-full transition-colors relative cursor-pointer",
                                                    element.content.autoplay ? "bg-blue-500" : "bg-slate-200"
                                                )} onClick={() => onUpdateElement(element.id, { content: { ...element.content, autoplay: !element.content.autoplay } })}>
                                                    <div className={cn(
                                                        "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                                                        element.content.autoplay ? "left-4.5" : "left-0.5"
                                                    )} />
                                                </div>
                                                <Label className="text-xs font-normal">Autoplay</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="h-7 w-12 text-center text-[11px] bg-slate-50"
                                                    value={element.content.autoplaySpeed || 4}
                                                    onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, autoplaySpeed: parseInt(e.target.value) } })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <Label className="text-xs">Itens</Label>
                                    <div className="space-y-4">
                                        {(element.content.carouselItems || []).map((item: any, idx: number) => (
                                            <div key={idx} className="p-3 border rounded-lg space-y-3 bg-slate-50/50 relative group">
                                                <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-white hover:bg-slate-50 transition-colors cursor-pointer aspect-square">
                                                    {item.imageUrl ? (
                                                        <img src={item.imageUrl} className="w-full h-full object-cover rounded" alt="" />
                                                    ) : (
                                                        <ImageIcon className="h-6 w-6 text-slate-200" />
                                                    )}
                                                </div>
                                                {element.content.carouselLayout !== 'image-only' && (
                                                    <Input
                                                        className="h-8 text-[11px] bg-background"
                                                        value={item.description || ""}
                                                        placeholder="Exemplo de descrição"
                                                        onChange={(e) => {
                                                            const newItems = [...(element.content.carouselItems || [])];
                                                            newItems[idx] = { ...newItems[idx], description: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, carouselItems: newItems } });
                                                        }}
                                                    />
                                                )}
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border shadow-sm text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        const newItems = (element.content.carouselItems || []).filter((_: any, i: number) => i !== idx);
                                                        onUpdateElement(element.id, { content: { ...element.content, carouselItems: newItems } });
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline" size="sm" className="w-full text-xs font-medium"
                                            onClick={() => {
                                                const newItems = [...(element.content.carouselItems || []), { imageUrl: "", description: "Nova descrição" }];
                                                onUpdateElement(element.id, { content: { ...element.content, carouselItems: newItems } });
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-2" /> adicionar item
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Scheduler specific */}
                            {(element.type === 'scheduler') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Descrição</Label>
                                        <Textarea
                                            className="bg-slate-50 min-h-[60px]"
                                            value={element.content.description || ""}
                                            placeholder="Instruções para o agendamento..."
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, description: e.target.value } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Duração da Sessão (minutos)</Label>
                                        <Input
                                            type="number"
                                            className="bg-slate-50"
                                            value={element.content.duration || 30}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, duration: parseInt(e.target.value) } })}
                                        />
                                        <p className="text-[10px] text-muted-foreground">Tempo padrão bloqueado na agenda.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Closers (Responsáveis pela Agenda)</Label>
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {(element.content.closerIds || (element.content.closerId ? [element.content.closerId] : [])).map((cId: string) => {
                                                    const closer = closers?.find((c: any) => c.id === cId);
                                                    if (!closer) return null;
                                                    return (
                                                        <Badge key={cId} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                                                            <span className="max-w-[120px] truncate text-[10px]">{closer.full_name || closer.email}</span>
                                                            <button
                                                                className="hover:text-destructive transition-colors shrink-0"
                                                                onClick={() => {
                                                                    const currentIds = element.content.closerIds || (element.content.closerId ? [element.content.closerId] : []);
                                                                    const newIds = currentIds.filter((id: string) => id !== cId);
                                                                    onUpdateElement(element.id, {
                                                                        content: {
                                                                            ...element.content,
                                                                            closerIds: newIds,
                                                                            closerId: newIds[0] || "" // Keep single closerId for backward compatibility
                                                                        }
                                                                    });
                                                                }}
                                                            >
                                                                <Trash2 className="h-2 w-2" />
                                                            </button>
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                            <Select
                                                value=""
                                                onValueChange={(val) => {
                                                    if (!val) return;
                                                    const currentIds = element.content.closerIds || (element.content.closerId ? [element.content.closerId] : []);
                                                    if (currentIds.includes(val)) return;
                                                    const newIds = [...currentIds, val];
                                                    onUpdateElement(element.id, {
                                                        content: {
                                                            ...element.content,
                                                            closerIds: newIds,
                                                            closerId: newIds[0] || "" // Keep single closerId for backward compatibility
                                                        }
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50">
                                                    <SelectValue placeholder="Adicionar closer..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {closers?.map((closer: any) => (
                                                        <SelectItem key={closer.id} value={closer.id}>
                                                            {closer.full_name || closer.email}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic leading-tight">
                                            Selecione um ou mais closers. O quiz mostrará a disponibilidade combinada de todos eles e distribuirá os agendamentos.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Custom Code specific */}
                            {(element.type === 'custom_code') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">HTML Customizado</Label>
                                        <Textarea
                                            className="font-mono text-[10px] bg-slate-900 text-slate-100 min-h-[200px]"
                                            value={element.content.customCode || ""}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, customCode: e.target.value } })}
                                            placeholder="<div class='...'>...</div>"
                                        />
                                        <p className="text-[10px] text-slate-400 italic">
                                            Você pode usar variáveis: {"{{score}}"}, {"{{campo_id}}"}, etc.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">CSS Customizado</Label>
                                        <Textarea
                                            className="font-mono text-[10px] bg-slate-900 text-slate-100 min-h-[100px]"
                                            value={element.content.customCss || ""}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, customCss: e.target.value } })}
                                            placeholder=".custom-class { ... }"
                                        />
                                    </div>

                                    <Button
                                        className="w-full bg-slate-100 text-slate-900 border"
                                        onClick={async () => {
                                            if (!workspaceId) {
                                                toast.error("Workflow / Workspace não identificado");
                                                return;
                                            }
                                            const name = prompt("Nome do elemento para salvar na biblioteca:");
                                            if (!name) return;

                                            const { error } = await supabase
                                                .from('custom_quiz_elements' as any)
                                                .insert({
                                                    workspace_id: workspaceId,
                                                    name: name,
                                                    type: element.type,
                                                    content: element.content,
                                                    icon: 'Sparkles'
                                                });

                                            if (error) {
                                                toast.error("Erro ao salvar: " + error.message);
                                            } else {
                                                toast.success("Elemento salvo na biblioteca!");
                                            }
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" /> Salvar na Biblioteca
                                    </Button>
                                </div>
                            )}

                            {/* Video specific */}
                            {(element.type === 'video') && (
                                <div className="space-y-4">
                                    <Tabs defaultValue={element.content.type || "embed"} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 h-9 bg-slate-100 p-1">
                                            <TabsTrigger value="embed" className="text-[10px] py-1" onClick={() => onUpdateElement(element.id, { content: { ...element.content, type: 'embed' } })}>Link / Embed</TabsTrigger>
                                            <TabsTrigger value="upload" className="text-[10px] py-1" onClick={() => onUpdateElement(element.id, { content: { ...element.content, type: 'upload' } })}>Upload</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="embed" className="mt-4 space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">URL do Vídeo</Label>
                                                <Input
                                                    className="bg-slate-50 h-10"
                                                    value={element.content.url || ""}
                                                    placeholder="YouTube, Vimeo, Loom, Vturb..."
                                                    onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, url: e.target.value, type: 'embed' } })}
                                                />
                                                <p className="text-[10px] text-slate-400 font-medium">Suporte para YouTube, Vimeo, Loom, Vturb e outros.</p>
                                            </div>
                                            {element.content.url && element.content.type === 'embed' && (
                                                <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 aspect-video flex items-center justify-center">
                                                    <Video className="h-8 w-8 text-slate-300" />
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="upload" className="mt-4 space-y-4">
                                            <div
                                                className="border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group relative overflow-hidden"
                                                onClick={() => document.getElementById(`video-upload-${element.id}`)?.click()}
                                            >
                                                <input
                                                    id={`video-upload-${element.id}`}
                                                    type="file"
                                                    className="hidden"
                                                    accept="video/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;

                                                        const promise = new Promise(async (resolve, reject) => {
                                                            try {
                                                                const fileExt = file.name.split('.').pop();
                                                                const fileName = `${Math.random()}.${fileExt}`;
                                                                const filePath = `${fileName}`;

                                                                const { error: uploadError } = await supabase.storage
                                                                    .from('quiz-assets')
                                                                    .upload(filePath, file);

                                                                if (uploadError) throw uploadError;

                                                                const { data: { publicUrl } } = supabase.storage
                                                                    .from('quiz-assets')
                                                                    .getPublicUrl(filePath);

                                                                onUpdateElement(element.id, { content: { ...element.content, url: publicUrl, type: 'upload' } });
                                                                resolve(publicUrl);
                                                            } catch (err) {
                                                                reject(err);
                                                            }
                                                        });

                                                        toast.promise(promise, {
                                                            loading: 'Enviando vídeo...',
                                                            success: 'Vídeo enviado com sucesso!',
                                                            error: 'Erro ao enviar vídeo (máx 50MB no plano free)'
                                                        });
                                                    }}
                                                />
                                                <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-500">
                                                    <Upload className="h-8 w-8" />
                                                    <span className="text-[11px] font-medium">Clique para subir vídeo</span>
                                                </div>
                                            </div>
                                            {element.content.url && element.content.type === 'upload' && (
                                                <div className="relative group rounded-xl border overflow-hidden bg-slate-900 aspect-video">
                                                    <video src={element.content.url} className="w-full h-full object-contain" controls />
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => {
                                                            e.stopPropagation();
                                                            onUpdateElement(element.id, { content: { ...element.content, url: "" } });
                                                        }}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            )}

                            {/* Timer specific */}
                            {(element.type === 'timer') && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Tempo (seg.)</Label>
                                        <Input
                                            type="number"
                                            className="h-10 text-center bg-slate-50"
                                            value={element.content.timerDuration === undefined ? 20 : element.content.timerDuration}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                onUpdateElement(element.id, { content: { ...element.content, timerDuration: isNaN(val) ? 0 : val } });
                                            }}
                                        />
                                    </div>

                                    <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-[11px] border border-blue-100">
                                        Utilize [time] para posicionar a contagem regressiva
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label className="text-xs">Estilo</Label>
                                        <select
                                            className="w-full h-9 bg-slate-50 border rounded-md text-sm px-2"
                                            value={element.content.timerStyle || "red"}
                                            onChange={(e) => onUpdateElement(element.id, { content: { ...element.content, timerStyle: e.target.value as any } })}
                                        >
                                            <option value="red">Vermelho</option>
                                            <option value="blue">Azul</option>
                                            <option value="green">Verde</option>
                                            <option value="dark">Escuro</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* FAQ specific */}
                            {(element.type === 'faq') && (
                                <div className="space-y-4">
                                    <Label className="text-xs">Itens do FAQ</Label>
                                    <div className="space-y-4">
                                        {(element.content.items || []).map((item: any, idx: number) => (
                                            <div key={idx} className="p-3 border rounded-lg space-y-3 bg-slate-50/50 relative group">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-slate-400">Pergunta</Label>
                                                    <Input
                                                        className="h-8 text-sm bg-background"
                                                        value={item.question}
                                                        onChange={(e) => {
                                                            const newItems = [...(element.content.items || [])];
                                                            newItems[idx] = { ...newItems[idx], question: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, items: newItems } });
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-slate-400">Resposta</Label>
                                                    <Textarea
                                                        className="text-sm bg-white min-h-[60px]"
                                                        value={item.answer}
                                                        onChange={(e) => {
                                                            const newItems = [...(element.content.items || [])];
                                                            newItems[idx] = { ...newItems[idx], answer: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, items: newItems } });
                                                        }}
                                                    />
                                                </div>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border shadow-sm text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        const newItems = (element.content.items || []).filter((_: any, i: number) => i !== idx);
                                                        onUpdateElement(element.id, { content: { ...element.content, items: newItems } });
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline" size="sm" className="w-full text-xs dashed border-2 border-dashed"
                                            onClick={() => {
                                                const newItems = [...(element.content.items || []), { question: "Nova Pergunta", answer: "Sua resposta..." }];
                                                onUpdateElement(element.id, { content: { ...element.content, items: newItems } });
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-2" /> Adicionar FAQ
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="appearance" className="flex-1 min-h-0 overflow-y-auto m-0 p-4 space-y-6 focus-visible:outline-none">
                        <div className="space-y-6">
                            {/* Conditional Appearence Controls based on Element Type */}
                            {(element.type === 'single_choice' || element.type === 'multiple_choice') && (
                                <div className="space-y-4 border-b pb-4 mb-4 border-slate-100">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Estilo</Label>
                                        <Select
                                            value={element.content.appearance?.style || "simple"}
                                            onValueChange={(v) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    appearance: { ...(element.content.appearance || {}), style: v }
                                                }
                                            })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="simple">Simples</SelectItem>
                                                <SelectItem value="highlight">Destacar</SelectItem>
                                                <SelectItem value="relief">Relevo</SelectItem>
                                                <SelectItem value="contrast">Contraste</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="flex items-center space-x-2 mt-2">
                                            <input
                                                type="checkbox"
                                                id="transparentBg"
                                                className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                                                checked={element.content.appearance?.transparentBackground || false}
                                                onChange={(e) => onUpdateElement(element.id, {
                                                    content: {
                                                        ...element.content,
                                                        appearance: { ...(element.content.appearance || {}), transparentBackground: e.target.checked }
                                                    }
                                                })}
                                            />
                                            <label htmlFor="transparentBg" className="text-xs text-slate-600 font-medium cursor-pointer select-none">Imagem com fundo transparente</label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Layout</Label>
                                            <Select
                                                value={element.content.appearance?.layout || "list"}
                                                onValueChange={(v) => onUpdateElement(element.id, {
                                                    content: {
                                                        ...element.content,
                                                        appearance: { ...(element.content.appearance || {}), layout: v }
                                                    }
                                                })}
                                            >
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="list">Itens em lista</SelectItem>
                                                    <SelectItem value="spread">Itens espalhados</SelectItem>
                                                    <SelectItem value="grid-2">Grade de 2 colunas</SelectItem>
                                                    <SelectItem value="grid-3">Grade de 3 colunas</SelectItem>
                                                    <SelectItem value="grid-4">Grade de 4 colunas</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Orientação</Label>
                                            <Select
                                                value={element.content.appearance?.orientation || "horizontal"}
                                                onValueChange={(v) => onUpdateElement(element.id, {
                                                    content: {
                                                        ...element.content,
                                                        appearance: { ...(element.content.appearance || {}), orientation: v }
                                                    }
                                                })}
                                            >
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="horizontal">Horizontal</SelectItem>
                                                    <SelectItem value="vertical">Vertical</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Proporção de imagens</Label>
                                        <Select
                                            value={element.content.appearance?.imageRatio || "auto"}
                                            onValueChange={(v) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    appearance: { ...(element.content.appearance || {}), imageRatio: v }
                                                }
                                            })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto">Auto</SelectItem>
                                                <SelectItem value="square">Quadrado (1:1)</SelectItem>
                                                <SelectItem value="video">Vídeo (16:9)</SelectItem>
                                                <SelectItem value="portrait">Retrato (3:4)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Disposição</Label>
                                        <Select
                                            value={element.content.appearance?.disposition || "image-text"}
                                            onValueChange={(v) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    appearance: { ...(element.content.appearance || {}), disposition: v }
                                                }
                                            })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="image-text">Imagem | Texto</SelectItem>
                                                <SelectItem value="text-image">Texto | Imagem</SelectItem>
                                                <SelectItem value="image-only">Somente Imagem</SelectItem>
                                                <SelectItem value="text-only">Somente Texto</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Detalhe</Label>
                                        <Select
                                            value={element.content.appearance?.detail || "none"}
                                            onValueChange={(v) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    appearance: { ...(element.content.appearance || {}), detail: v }
                                                }
                                            })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Nenhum</SelectItem>
                                                <SelectItem value="arrow">Seta</SelectItem>
                                                <SelectItem value="checkbox">Checkbox</SelectItem>
                                                <SelectItem value="points">Pontos</SelectItem>
                                                <SelectItem value="value">Valor</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {/* General Appearance */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Espaçamento Interno</Label>
                                    <Select
                                        value={element.content.appearance?.spacing || "normal"}
                                        onValueChange={(v) => onUpdateElement(element.id, {
                                            content: {
                                                ...element.content,
                                                appearance: { ...(element.content.appearance || {}), spacing: v }
                                            }
                                        })}
                                    >
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="compact">Compacto</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="relaxed">Espaçoso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Bordas</Label>
                                        <Select
                                            value={element.content.appearance?.borderRadius || "md"}
                                            onValueChange={(v) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    appearance: { ...(element.content.appearance || {}), borderRadius: v }
                                                }
                                            })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Nenhuma</SelectItem>
                                                <SelectItem value="sm">Pequena</SelectItem>
                                                <SelectItem value="md">Média</SelectItem>
                                                <SelectItem value="lg">Grande</SelectItem>
                                                <SelectItem value="full">Arredondada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Sombra</Label>
                                        <Select
                                            value={element.content.appearance?.shadow || "none"}
                                            onValueChange={(v) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    appearance: { ...(element.content.appearance || {}), shadow: v }
                                                }
                                            })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Nenhuma</SelectItem>
                                                <SelectItem value="sm">Leve</SelectItem>
                                                <SelectItem value="md">Suave</SelectItem>
                                                <SelectItem value="lg">Pronunciada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Largura do Componente</Label>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-mono text-slate-500">{element.content.appearance?.width || 100}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        step="5"
                                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        value={element.content.appearance?.width || 100}
                                        onChange={(e) => onUpdateElement(element.id, {
                                            content: {
                                                ...element.content,
                                                appearance: { ...(element.content.appearance || {}), width: parseInt(e.target.value) }
                                            }
                                        })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Alinhamento Horizontal</Label>
                                        <Select
                                            value={element.content.appearance?.alignment || "left"}
                                            onValueChange={(v) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    appearance: { ...(element.content.appearance || {}), alignment: v }
                                                }
                                            })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="left">Começo (Esq)</SelectItem>
                                                <SelectItem value="center">Centro</SelectItem>
                                                <SelectItem value="right">Fim (Dir)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Alinhamento Vertical</Label>
                                        <Select
                                            value={element.content.appearance?.verticalAlignment || "auto"}
                                            onValueChange={(v) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    appearance: { ...(element.content.appearance || {}), verticalAlignment: v }
                                                }
                                            })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto">Auto</SelectItem>
                                                <SelectItem value="start">Topo</SelectItem>
                                                <SelectItem value="center">Centro</SelectItem>
                                                <SelectItem value="end">Base</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="display" className="flex-1 min-h-0 overflow-y-auto m-0 p-4 space-y-6 focus-visible:outline-none">
                        <div className="space-y-6">
                            {/* Display Timing */}
                            <div className="space-y-3">
                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tempo de Exibição</Label>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <Input
                                            type="number"
                                            className="h-9 text-xs bg-slate-50"
                                            placeholder="0"
                                            value={element.content.display?.delay || 0}
                                            onChange={(e) => onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    display: { ...(element.content.display || {}), delay: parseInt(e.target.value) || 0 }
                                                }
                                            })}
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium italic">segundos de atraso</span>
                                </div>
                            </div>

                            <Separator />

                            {/* Display Rules */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Regras de Exibição</Label>
                                </div>

                                <div className="space-y-3">
                                    {(element.content.display?.rules || []).map((rule: any, idx: number) => (
                                        <div key={idx} className="p-3 border rounded-xl bg-slate-50 relative group/rule">
                                            <div className="space-y-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] text-slate-400 uppercase font-bold">Variável / Condição</Label>
                                                    <Input
                                                        className="h-8 text-xs bg-background"
                                                        placeholder="{{score}} ou calc(...)"
                                                        value={rule.condition}
                                                        onChange={(e) => {
                                                            const newRules = [...(element.content.display.rules || [])];
                                                            newRules[idx] = { ...newRules[idx], condition: e.target.value };
                                                            onUpdateElement(element.id, { content: { ...element.content, display: { ...element.content.display, rules: newRules } } });
                                                        }}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] text-slate-400 uppercase font-bold">Operador</Label>
                                                        <Select
                                                            value={rule.operator}
                                                            onValueChange={(v) => {
                                                                const newRules = [...(element.content.display.rules || [])];
                                                                newRules[idx] = { ...newRules[idx], operator: v };
                                                                onUpdateElement(element.id, { content: { ...element.content, display: { ...element.content.display, rules: newRules } } });
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8 text-[11px] bg-background">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {OPERATORS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] text-muted-foreground/50 uppercase font-bold">Valor</Label>
                                                        <Input
                                                            className="h-8 text-xs bg-background"
                                                            placeholder="Valor"
                                                            value={rule.value}
                                                            onChange={(e) => {
                                                                const newRules = [...(element.content.display.rules || [])];
                                                                newRules[idx] = { ...newRules[idx], value: e.target.value };
                                                                onUpdateElement(element.id, { content: { ...element.content, display: { ...element.content.display, rules: newRules } } });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost" size="icon"
                                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-card border shadow-sm text-destructive hover:bg-destructive/10 opacity-0 group-hover/rule:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    const newRules = (element.content.display.rules || []).filter((_: any, i: number) => i !== idx);
                                                    onUpdateElement(element.id, { content: { ...element.content, display: { ...element.content.display, rules: newRules } } });
                                                }}
                                            >
                                                <Trash2 className="h-2.5 w-2.5" />
                                            </Button>
                                        </div>
                                    ))}

                                    <Button
                                        variant="outline" size="sm" className="w-full text-xs h-9 border-dashed"
                                        onClick={() => {
                                            const currentRules = element.content.display?.rules || [];
                                            onUpdateElement(element.id, {
                                                content: {
                                                    ...element.content,
                                                    display: {
                                                        ...(element.content.display || {}),
                                                        rules: [...currentRules, { condition: "{{score}}", operator: "==", value: "" }]
                                                    }
                                                }
                                            });
                                        }}
                                    >
                                        <Plus className="h-3 w-3 mr-2" /> Adicionar regra
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
                {/* Hidden File Input for Option Uploads - Must be present when element is active */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleImageUpload}
                    accept="image/*"
                />
            </div>
        );
    }

    // 3. Page Properties (Fallback)
    return (
        <div className="w-80 border-l bg-card h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b bg-card min-h-[49px] flex items-center">
                <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground/60">Etapa</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Título da Etapa</Label>
                        <Input
                            value={page.text}
                            onChange={(e) => onUpdatePage({ ...page, text: e.target.value })}
                            className="bg-muted/30 border-border focus-visible:ring-primary/20"
                            placeholder="Ex: Introdução"
                        />
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 block">Estilo Global do Quiz</Label>

                        {onUpdateQuizSettings ? (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-700 font-medium">Estilo do Layout (Box)</Label>
                                    <Select
                                        value={quizSettings?.theme?.containerStyle || 'card'}
                                        onValueChange={(v) => onUpdateQuizSettings({ containerStyle: v })}
                                    >
                                        <SelectTrigger className="bg-slate-50 text-xs h-9 border-slate-200">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="card">Cartão (Box Padrão)</SelectItem>
                                            <SelectItem value="clean">Clean (Transparente)</SelectItem>
                                            <SelectItem value="flat">Totalmente Plano (Sem sombras)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-slate-400">
                                        {quizSettings?.theme?.containerStyle === 'clean'
                                            ? "Remove o fundo branco e sombras atrás do quiz."
                                            : "Aparência padrão com fundo branco e sombras."}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-700 font-medium">Cor dos Botões (Primária)</Label>
                                    <div className="flex gap-2 items-center">
                                        <div
                                            className="w-9 h-9 rounded-md border shadow-sm shrink-0 transition-colors"
                                            style={{ backgroundColor: quizSettings?.theme?.primaryColor || '#0f172a' }}
                                        />
                                        <div className="flex-1 relative">
                                            <Input
                                                type="text"
                                                className="h-9 text-xs font-mono uppercase pl-8"
                                                value={quizSettings?.theme?.primaryColor || '#0f172a'}
                                                onChange={(e) => onUpdateQuizSettings({ primaryColor: e.target.value })}
                                                placeholder="#000000"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">#</span>
                                        </div>
                                        <Input
                                            type="color"
                                            className="h-9 w-9 p-0 border-0 shrink-0 cursor-pointer rounded-md overflow-hidden"
                                            value={quizSettings?.theme?.primaryColor || '#0f172a'}
                                            onChange={(e) => onUpdateQuizSettings({ primaryColor: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-700 font-medium">Cor da Barra de Progresso</Label>
                                    <div className="flex gap-2 items-center">
                                        <div
                                            className="w-9 h-9 rounded-md border shadow-sm shrink-0 transition-colors"
                                            style={{ backgroundColor: quizSettings?.theme?.progressBarColor || '#0f172a' }}
                                        />
                                        <div className="flex-1 relative">
                                            <Input
                                                type="text"
                                                className="h-9 text-xs font-mono uppercase pl-8"
                                                value={quizSettings?.theme?.progressBarColor || '#0f172a'}
                                                onChange={(e) => onUpdateQuizSettings({ progressBarColor: e.target.value })}
                                                placeholder="#000000"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">#</span>
                                        </div>
                                        <Input
                                            type="color"
                                            className="h-9 w-9 p-0 border-0 shrink-0 cursor-pointer rounded-md overflow-hidden"
                                            value={quizSettings?.theme?.progressBarColor || '#0f172a'}
                                            onChange={(e) => onUpdateQuizSettings({ progressBarColor: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-lg bg-orange-50 border border-orange-100 flex flex-col items-center justify-center gap-2 text-center">
                                <Settings className="h-5 w-5 text-orange-400" />
                                <p className="text-[10px] text-orange-600/80">Recurso de personalização global indisponível neste contexto.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Hidden File Input for Option Uploads */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageUpload}
                accept="image/*"
            />
        </div>
    );
}
