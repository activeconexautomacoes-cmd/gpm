import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  corsPreflightResponse,
} from "../_shared/cors.ts";

/**
 * KB Agent Chat — Orquestrador Principal (GPM)
 *
 * Gerencia a conversa com o agente de coleta de KB para processos internos:
 * 1. Salva mensagem do usuário
 * 2. Carrega contexto (histórico, scores, critérios faltantes)
 * 3. Processa attachments (delega para kb-upload-process)
 * 4. Gera resposta via Claude (persona consultor de processos)
 * 5. Extrai informações relevantes e salva como documentos KB
 * 6. Dispara análise de scores
 * 7. Salva resposta e retorna
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const CATEGORY_LABELS: Record<string, string> = {
  operacional: "Operacional (Processos de operação e entrega)",
  marketing: "Marketing (Tráfego, copy, social media, relatórios)",
  comercial: "Comercial (Vendas, prospecção, propostas)",
  financeira: "Financeira (Faturamento, cobrança, custos)",
};

interface ChatRequest {
  conversation_id?: string;
  workspace_id: string;
  message?: string;
  wizard_choice?: "has_materials" | "from_scratch";
  attachments?: Array<{
    filename: string;
    file_url: string;
    file_type: "md" | "txt" | "pdf" | "docx";
    mime_type?: string;
    size?: number;
  }>;
}

interface ConversationContext {
  conversationId: string;
  wizardChoice: string | null;
  overallScore: number;
  categoryScores: Record<string, number>;
  recentMessages: Array<{ role: string; content: string }>;
  missingCriteria: Record<string, string[]>;
  superficialCriteria: Record<string, string[]>;
  lastMessageAt: string | null;
}

async function getOrCreateConversation(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  conversationId: string | undefined,
  wizardChoice?: string
): Promise<ConversationContext> {
  let convId = conversationId;

  if (!convId) {
    const { data: conv, error } = await supabase
      .from("kb_conversations")
      .insert({
        workspace_id: workspaceId,
        status: "active",
        wizard_choice: wizardChoice || null,
        overall_score: 0,
        category_scores: {},
      })
      .select("id")
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    convId = conv.id;
  }

  const { data: conv } = await supabase
    .from("kb_conversations")
    .select("*")
    .eq("id", convId)
    .single();

  if (!conv) throw new Error("Conversation not found");

  const { data: messages } = await supabase
    .from("kb_messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .limit(20);

  const recentMessages = (messages || []).reverse();

  const { data: scores } = await supabase
    .from("kb_quality_scores")
    .select("category, score, missing_items, superficial_items")
    .eq("workspace_id", workspaceId);

  const categoryScores: Record<string, number> = {};
  const missingCriteria: Record<string, string[]> = {};
  const superficialCriteria: Record<string, string[]> = {};

  if (scores) {
    for (const s of scores) {
      categoryScores[s.category] = Number(s.score);
      missingCriteria[s.category] = s.missing_items || [];
      superficialCriteria[s.category] = s.superficial_items || [];
    }
  }

  const allCats = ["operacional", "marketing", "comercial", "financeira"];
  const realOverall = allCats.length > 0
    ? Math.round((allCats.reduce((sum, cat) => sum + (categoryScores[cat] ?? 0), 0) / allCats.length) * 10) / 10
    : 0;

  return {
    conversationId: convId,
    wizardChoice: conv.wizard_choice,
    overallScore: realOverall,
    categoryScores,
    recentMessages,
    missingCriteria,
    superficialCriteria,
    lastMessageAt: conv.updated_at || null,
  };
}

function buildSystemPrompt(ctx: ConversationContext): string {
  const scoresSummary = Object.entries(CATEGORY_LABELS)
    .map(([key, label]) => {
      const score = ctx.categoryScores[key] ?? 0;
      const missing = ctx.missingCriteria[key] || [];
      const superficial = ctx.superficialCriteria[key] || [];
      let status = `${score.toFixed(1)}/10`;
      if (missing.length > 0) status += ` | Faltam: ${missing.join(", ")}`;
      if (superficial.length > 0) status += ` | Superficiais: ${superficial.join(", ")}`;
      return `- ${label}: ${status}`;
    })
    .join("\n");

  let lowestCat = "operacional";
  let lowestScore = 10;
  for (const [cat] of Object.entries(CATEGORY_LABELS)) {
    const score = ctx.categoryScores[cat] ?? 0;
    if (score < lowestScore) {
      lowestScore = score;
      lowestCat = cat;
    }
  }

  let resumeContext = "";
  if (ctx.lastMessageAt) {
    const lastTime = new Date(ctx.lastMessageAt).getTime();
    const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
    if (hoursSince > 24) {
      resumeContext = `\n\n## Retomada de Conversa\nO usuário esteve ausente por ${Math.round(hoursSince)} horas. Faça um resumo rápido do status geral antes de continuar com as perguntas.`;
    } else if (hoursSince > 1) {
      resumeContext = `\n\n## Retomada de Conversa\nO usuário voltou após ${Math.round(hoursSince)} horas. Retome de onde pararam de forma natural.`;
    }
  }

  return `Você é um consultor sênior de operações e processos para agências de marketing digital. Você está conduzindo uma sessão de coleta de base de conhecimento para documentar os processos internos (SOPs) da agência.

## Seu Objetivo
Coletar informações ricas e específicas para levar a Base de Conhecimento da agência a 10/10 em todas as categorias. Você é meticuloso, estratégico e prático.

## Scores Atuais da Base de Conhecimento
Score geral: ${ctx.overallScore.toFixed(1)}/10 (meta: 9+/10)

${scoresSummary}

## Categoria Prioritária
A categoria com menor score é "${CATEGORY_LABELS[lowestCat]}" (${lowestScore.toFixed(1)}/10). Priorize perguntas sobre ela.${resumeContext}

## REGRA CRÍTICA SOBRE SCORES
Os scores listados acima são os ÚNICOS scores corretos. NUNCA invente, estime ou "adivinhe" scores diferentes.

## Regras de Comportamento

1. **Adaptativo**: Se o usuário é sucinto, faça perguntas diretas. Se é detalhista, aprofunde com follow-ups.

2. **Convite constante**: Sugira ao usuário que ele pode:
   - Anexar um documento sobre o tema (PDF, Word, texto)
   - Ou simplesmente digitar a resposta
   Use variações naturais.

3. **Feedback de progresso**: Quando processar informação nova, informe a mudança de score.

4. **Uma pergunta por vez**: Não faça múltiplas perguntas na mesma mensagem. Foque em um critério de cada vez.

5. **Prioridade de perguntas**:
   - Categoria com menor score primeiro
   - Dentro da categoria, critérios ausentes (required) de maior peso
   - Depois, aprofundar critérios superficiais

6. **Extrair informações**: Quando o usuário fornecer informações, identifique e categorize. Confirme o que entendeu.

7. **Tom consultivo**: Aja como um consultor experiente em reunião de briefing. Demonstre conhecimento sobre operações de agência, dê sugestões quando apropriado.

8. **Foco em SOPs**: As informações coletadas serão usadas como SOPs (Standard Operating Procedures). Busque detalhes actionables: checklists, responsáveis, ferramentas, SLAs, frequências.

9. **Meta compartilhada**: Comunique que vocês estão trabalhando juntos para documentar os processos da agência e chegar em 10/10.

10. **Nunca invente informações**: Apenas registre o que o usuário fornecer ou confirmar.

## Formato de Resposta
Responda de forma natural e conversacional em português brasileiro.

Ao final de cada resposta, inclua um bloco JSON oculto:
<metadata>
{
  "categories_affected": ["lista de categorias afetadas pela informação recebida"],
  "information_extracted": "resumo da informação nova extraída (ou null se nenhuma)",
  "score_feedback": "mensagem de feedback de score para mostrar ao usuário (ou null)"
}
</metadata>`;
}

function buildFirstMessage(wizardChoice: string): string {
  if (wizardChoice === "has_materials") {
    return `Ótimo que você já tem materiais documentados!

Pode me enviar seus documentos — SOPs, playbooks, checklists, templates, o que tiver. Enquanto eu analiso, vou te fazer algumas perguntas para entender melhor os processos da agência.

Você pode anexar arquivos (PDF, Word, texto) ou simplesmente digitar aqui.

Por onde quer começar?`;
  }

  return `Vamos documentar juntos os processos da agência!

Vou te guiar por cada área importante: operacional, marketing, comercial e financeiro. Com os processos bem documentados, a equipe toda vai poder consultar e seguir os mesmos padrões.

Para começar: **me conta como funciona o onboarding de um novo cliente na agência**. O que acontece desde o fechamento do contrato até o início das entregas?

Pode digitar aqui ou, se tiver algum documento inicial, pode anexar!`;
}

function extractMetadata(
  response: string
): { cleanResponse: string; metadata: Record<string, unknown> | null } {
  const metadataMatch = response.match(/<metadata>([\s\S]*?)<\/metadata>/);
  if (!metadataMatch) {
    return { cleanResponse: response, metadata: null };
  }

  const cleanResponse = response.replace(/<metadata>[\s\S]*?<\/metadata>/, "").trim();
  try {
    const metadata = JSON.parse(metadataMatch[1].trim());
    return { cleanResponse, metadata };
  } catch {
    return { cleanResponse, metadata: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return errorResponse("ANTHROPIC_API_KEY not configured", 500);
    }

    const body: ChatRequest = await req.json();
    const {
      workspace_id,
      message,
      wizard_choice,
      attachments,
    } = body;

    if (!workspace_id) {
      return errorResponse("workspace_id required");
    }

    const ctx = await getOrCreateConversation(
      supabase,
      workspace_id,
      body.conversation_id,
      wizard_choice
    );

    // First message — generate welcome
    if (ctx.recentMessages.length === 0 && wizard_choice && !message) {
      const welcomeMessage = buildFirstMessage(wizard_choice);

      await supabase.from("kb_messages").insert({
        conversation_id: ctx.conversationId,
        role: "assistant",
        content: welcomeMessage,
        message_type: "text",
        metadata: { type: "welcome", wizard_choice },
      });

      return jsonResponse({
        success: true,
        conversation_id: ctx.conversationId,
        message: welcomeMessage,
        overall_score: ctx.overallScore,
        category_scores: ctx.categoryScores,
        background_tasks: [],
      });
    }

    // Save user message
    if (message) {
      await supabase.from("kb_messages").insert({
        conversation_id: ctx.conversationId,
        role: "user",
        content: message,
        message_type: "text",
        attachments: attachments
          ? attachments.map((a) => ({
              filename: a.filename,
              file_url: a.file_url,
              file_type: a.file_type,
              size: a.size,
            }))
          : [],
      });
    }

    // Process attachments in background
    const backgroundTasks: string[] = [];
    if (attachments?.length) {
      for (const att of attachments) {
        fetch(`${supabaseUrl}/functions/v1/kb-upload-process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            workspace_id,
            conversation_id: ctx.conversationId,
            file_url: att.file_url,
            filename: att.filename,
            file_type: att.file_type,
            mime_type: att.mime_type,
          }),
        }).catch((err) =>
          console.error(`Failed to process ${att.filename}:`, err)
        );
        backgroundTasks.push(`Processando: ${att.filename}`);
      }
    }

    // Build messages for Claude
    const systemPrompt = buildSystemPrompt(ctx);
    const claudeMessages = ctx.recentMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    if (message) {
      let userContent = message;
      if (attachments?.length) {
        const fileList = attachments.map((a) => a.filename).join(", ");
        userContent += `\n\n[Arquivos anexados e sendo processados em background: ${fileList}]`;
      }
      claudeMessages.push({ role: "user", content: userContent });
    }

    // Ensure messages alternate correctly
    const sanitizedMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const msg of claudeMessages) {
      if (sanitizedMessages.length === 0 || sanitizedMessages[sanitizedMessages.length - 1].role !== msg.role) {
        sanitizedMessages.push(msg);
      } else {
        sanitizedMessages[sanitizedMessages.length - 1].content += "\n\n" + msg.content;
      }
    }

    if (sanitizedMessages.length > 0 && sanitizedMessages[0].role !== "user") {
      sanitizedMessages.shift();
    }

    if (sanitizedMessages.length === 0) {
      return errorResponse("No message to process");
    }

    // Call Claude
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: sanitizedMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const rawResponse = data.content?.[0]?.text || "";

    const { cleanResponse, metadata } = extractMetadata(rawResponse);

    // Save assistant response
    await supabase.from("kb_messages").insert({
      conversation_id: ctx.conversationId,
      role: "assistant",
      content: cleanResponse,
      message_type: "text",
      metadata: metadata || {},
    });

    // If Claude extracted information, save it and trigger analyze
    if (metadata?.information_extracted && metadata.categories_affected) {
      const categories = metadata.categories_affected as string[];

      if (typeof metadata.information_extracted === "string" && metadata.information_extracted.length > 50) {
        fetch(`${supabaseUrl}/functions/v1/kb-upload-process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            workspace_id,
            conversation_id: ctx.conversationId,
            content: metadata.information_extracted,
            filename: `chat-extract-${Date.now()}.md`,
            file_type: "md",
          }),
        }).catch((err) =>
          console.error("Failed to save extracted info:", err)
        );
        backgroundTasks.push("Salvando informações na KB");
      }

      if (categories.length > 0) {
        fetch(`${supabaseUrl}/functions/v1/kb-agent-analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            workspace_id,
            conversation_id: ctx.conversationId,
            categories,
          }),
        }).catch((err) =>
          console.error("Failed to trigger analyze:", err)
        );
        backgroundTasks.push(`Reavaliando: ${categories.join(", ")}`);
      }
    }

    return jsonResponse({
      success: true,
      conversation_id: ctx.conversationId,
      message: cleanResponse,
      metadata: metadata || {},
      overall_score: ctx.overallScore,
      category_scores: ctx.categoryScores,
      background_tasks: backgroundTasks,
    });
  } catch (err) {
    console.error("kb-agent-chat error:", err);
    return errorResponse((err as Error).message, 500);
  }
});
