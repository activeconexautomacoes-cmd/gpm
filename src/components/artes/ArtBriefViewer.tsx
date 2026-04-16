import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Palette, Type, Layout, Eye, FileText, ListChecks, Sparkles, MessageSquare, ShoppingBag } from "lucide-react";
import type { ArtRequestFormat, ArtBrief } from "@/types/artes";

interface ArtBriefViewerProps {
  formats: ArtRequestFormat[];
}

export function ArtBriefViewer({ formats }: ArtBriefViewerProps) {
  const formatsWithBrief = formats.filter((f) => f.ai_brief);

  if (formatsWithBrief.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Nenhum brief gerado ainda</p>
        <p className="text-sm">O brief será gerado pela IA após a solicitação.</p>
      </div>
    );
  }

  const defaultTab = formatsWithBrief[0]?.id;

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      {formatsWithBrief.length > 1 && (
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {formatsWithBrief.map((rf) => (
            <TabsTrigger key={rf.id} value={rf.id} className="text-xs">
              {rf.format?.name || "Formato"}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      {formatsWithBrief.map((rf) => (
        <TabsContent key={rf.id} value={rf.id}>
          <BriefContent brief={rf.ai_brief!} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function BriefContent({ brief }: { brief: ArtBrief }) {
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <Accordion type="multiple" defaultValue={["paleta", "tipografia", "layout", "textos", "passo"]} className="space-y-2">
      {/* Paleta de Cores */}
      <AccordionItem value="paleta" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <span className="font-semibold">Paleta de Cores</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {brief.paleta_cores?.map((cor, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                <div
                  className="h-10 w-10 rounded-lg border shadow-sm shrink-0"
                  style={{ backgroundColor: cor.hex }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{cor.nome}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{cor.hex}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{cor.uso}</p>
                </div>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Tipografia */}
      <AccordionItem value="tipografia" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            <span className="font-semibold">Tipografia</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            {Object.entries(brief.tipografia || {}).map(([key, value]) => (
              <div key={key} className="p-2 rounded border bg-muted/30">
                <p className="text-xs font-semibold capitalize mb-1">{key}</p>
                <p className="text-sm text-muted-foreground">{value}</p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Layout */}
      <AccordionItem value="layout" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <Layout className="h-4 w-4 text-primary" />
            <span className="font-semibold">Layout e Posicionamento</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground mb-3">{brief.layout?.grid}</p>
          <div className="space-y-2">
            {brief.layout?.elementos?.map((el, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded border bg-muted/30 text-sm">
                <span className="font-medium min-w-[100px]">{el.nome}</span>
                <span className="text-muted-foreground">{el.posicao}</span>
                <span className="ml-auto text-xs text-muted-foreground">{el.tamanho}</span>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Elementos Visuais */}
      <AccordionItem value="visuais" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span className="font-semibold">Elementos Visuais</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{brief.elementos_visuais}</p>
        </AccordionContent>
      </AccordionItem>

      {/* Textos */}
      <AccordionItem value="textos" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-semibold">Textos</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {Object.entries(brief.textos || {}).map(([key, value]) => (
              <div key={key} className="p-3 rounded-lg border bg-muted/30">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">{key}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Passo a Passo */}
      <AccordionItem value="passo" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="font-semibold">Passo a Passo</span>
            <span className="text-xs text-muted-foreground ml-2">
              {checkedSteps.size}/{brief.passo_a_passo?.length || 0}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {brief.passo_a_passo?.map((step, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-2 rounded border cursor-pointer transition-colors ${
                  checkedSteps.has(i) ? "bg-green-500/10 border-green-500/30" : "bg-muted/30"
                }`}
                onClick={() => toggleStep(i)}
              >
                <Checkbox checked={checkedSteps.has(i)} className="mt-0.5" />
                <p className={`text-sm ${checkedSteps.has(i) ? "line-through text-muted-foreground" : ""}`}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Produtos Sugeridos */}
      {(brief as any).produtos_sugeridos?.length > 0 && (
        <AccordionItem value="produtos" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="font-semibold">Produtos Sugeridos</span>
              <span className="text-xs text-muted-foreground ml-2">
                {(brief as any).produtos_sugeridos.length} produto(s)
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {(brief as any).produtos_sugeridos.map((prod: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-sm font-semibold">{prod.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">{prod.motivo}</p>
                  <p className="text-xs text-primary mt-1">Posição: {prod.posicao_na_arte}</p>
                  {prod.link && prod.link !== "NAO_ENCONTRADO" && prod.link !== "null" && prod.link !== null ? (
                    <a
                      href={prod.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                    >
                      Ver produto no site →
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground/70 mt-1 italic">
                      Designer deve buscar produto similar no site
                    </p>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}

      {/* Referências */}
      <AccordionItem value="referencias" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold">Referências de Estilo</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{brief.referencias_estilo}</p>
        </AccordionContent>
      </AccordionItem>

      {/* Observações */}
      <AccordionItem value="observacoes" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-semibold">Observações Finais</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{brief.observacoes}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

