import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  corsPreflightResponse,
} from "../_shared/cors.ts";

/**
 * KB Upload Process — Processador de Upload (GPM)
 *
 * Recebe arquivo do Storage ou conteúdo direto, processa:
 * 1. Texto/Doc → extrai conteúdo
 * 2. Classifica categoria via Claude (4 categorias GPM)
 * 3. Chama kb-ingest para chunking + embeddings
 * 4. Dispara kb-agent-analyze para reavaliar scores
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface UploadRequest {
  workspace_id: string;
  conversation_id?: string;
  file_url?: string;
  content?: string;
  filename: string;
  file_type: "md" | "txt" | "pdf" | "docx";
  mime_type?: string;
}

interface ClassificationResult {
  category: string;
  kb_type: string;
  title: string;
  tags: string[];
  summary: string;
}

async function classifyContent(
  content: string,
  filename: string,
  anthropicKey: string
): Promise<ClassificationResult> {
  const maxChars = 16000;
  const truncated =
    content.length > maxChars
      ? content.substring(0, maxChars) + "\n[... truncado ...]"
      : content;

  const prompt = `Você é um classificador de conteúdo para base de conhecimento de processos internos de uma agência de marketing digital.

Analise o conteúdo abaixo e classifique-o.

## Arquivo: ${filename}

## Conteúdo:
${truncated}

## Categorias disponíveis:
- operacional: Processos de operação (onboarding de clientes, rotinas de squad, gestão de demandas, ferramentas)
- marketing: Processos de marketing (estratégia, tráfego pago, copy para ads/LP/conteúdo, disparos WhatsApp, social media, relatórios)
- comercial: Processos comerciais (prospecção, proposta, followup, fechamento, pós-venda)
- financeira: Processos financeiros (faturamento, cobrança, inadimplência, conciliação, custos)

Retorne APENAS um JSON válido:
{
  "category": "a categoria mais adequada",
  "title": "título descritivo do conteúdo (máx 100 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "resumo do conteúdo em 2-3 frases"
}`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude classification error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const parsed = JSON.parse(cleaned);

  const kbType = parsed.category || "operacional";

  return {
    category: kbType,
    kb_type: kbType,
    title: parsed.title || filename,
    tags: parsed.tags || [],
    summary: parsed.summary || "",
  };
}

async function callKbIngest(
  supabaseUrl: string,
  serviceRoleKey: string,
  params: {
    workspace_id: string;
    path: string;
    content: string;
    title: string;
    category: string;
    kb_type: string;
    tags: string[];
    summary: string;
  }
): Promise<{ success: boolean; chunks_created: number }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/kb-ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      workspace_id: params.workspace_id,
      files: [
        {
          path: params.path,
          content: params.content,
          title: params.title,
          category: params.category,
          kb_type: params.kb_type,
          tags: params.tags,
          summary: params.summary,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`kb-ingest error: ${errText}`);
  }

  return await res.json();
}

async function triggerAnalyze(
  supabaseUrl: string,
  serviceRoleKey: string,
  params: {
    workspace_id: string;
    conversation_id?: string;
    categories: string[];
  }
): Promise<void> {
  fetch(`${supabaseUrl}/functions/v1/kb-agent-analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      workspace_id: params.workspace_id,
      conversation_id: params.conversation_id,
      categories: params.categories,
    }),
  }).catch((err) => console.error("Failed to trigger analyze:", err));
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

    const body: UploadRequest = await req.json();
    const {
      workspace_id,
      conversation_id,
      file_url,
      content: directContent,
      filename,
      file_type,
    } = body;

    if (!workspace_id || !filename) {
      return errorResponse("workspace_id and filename required");
    }

    let textContent = "";

    if (directContent) {
      textContent = directContent;
    } else if (file_url) {
      if (file_type === "pdf") {
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from("kb-uploads")
          .download(file_url);

        if (downloadErr || !fileData) {
          return errorResponse(
            `Failed to download file: ${downloadErr?.message || "not found"}`
          );
        }

        const bytes = new Uint8Array(await fileData.arrayBuffer());
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);

        const pdfRes = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "document",
                    source: {
                      type: "base64",
                      media_type: "application/pdf",
                      data: base64,
                    },
                  },
                  {
                    type: "text",
                    text: "Extraia todo o texto deste PDF. Retorne apenas o texto puro, sem formatação markdown, sem comentários. Mantenha a estrutura de parágrafos e títulos.",
                  },
                ],
              },
            ],
          }),
        });

        if (!pdfRes.ok) {
          throw new Error(`PDF extraction error: ${pdfRes.status}`);
        }

        const pdfData = await pdfRes.json();
        textContent = pdfData.content?.[0]?.text || "";
      } else if (file_type === "docx") {
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from("kb-uploads")
          .download(file_url);

        if (downloadErr || !fileData) {
          return errorResponse(
            `Failed to download file: ${downloadErr?.message || "not found"}`
          );
        }

        try {
          textContent = await fileData.text();
        } catch {
          textContent = new TextDecoder("utf-8", { fatal: false }).decode(
            new Uint8Array(await fileData.arrayBuffer())
          );
        }
        textContent = textContent
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      } else {
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from("kb-uploads")
          .download(file_url);

        if (downloadErr || !fileData) {
          return errorResponse(
            `Failed to download file: ${downloadErr?.message || "not found"}`
          );
        }

        textContent = await fileData.text();
      }
    } else {
      return errorResponse("Either file_url or content is required");
    }

    if (!textContent.trim()) {
      return errorResponse("No text content could be extracted from the file");
    }

    const classification = await classifyContent(
      textContent,
      filename,
      anthropicKey
    );

    const ingestPath = `uploads/${workspace_id}/${Date.now()}-${filename}`;
    const ingestResult = await callKbIngest(supabaseUrl, serviceRoleKey, {
      workspace_id,
      path: ingestPath,
      content: textContent,
      title: classification.title,
      category: classification.category,
      kb_type: classification.kb_type,
      tags: [...classification.tags, "upload"],
      summary: classification.summary,
    });

    triggerAnalyze(supabaseUrl, serviceRoleKey, {
      workspace_id,
      conversation_id,
      categories: [classification.kb_type],
    });

    return jsonResponse({
      success: true,
      filename,
      processed_as: file_type,
      classification: {
        category: classification.kb_type,
        title: classification.title,
        tags: classification.tags,
        summary: classification.summary,
      },
      chunks_created: ingestResult.chunks_created || 0,
      text_length: textContent.length,
    });
  } catch (err) {
    console.error("kb-upload-process error:", err);
    return errorResponse((err as Error).message, 500);
  }
});
