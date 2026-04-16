import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * SDR Analyze Calls — Analisa gravações de calls do closer no Google Drive
 * Extrai insights e cria sugestões de conhecimento para a SDR aprender
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const FOLDER_ID = "17UbzvevEpMZAbMy9AdCQ19ksy_8pbxJe";

function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlEncodeStr(str: string): string {
  return base64urlEncode(new TextEncoder().encode(str));
}
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/[\s\r\n]/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function supabaseFetch(path: string, options?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
      ...options?.headers,
    },
  });
}

async function getDriveToken(): Promise<string> {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: sa.client_email, scope: DRIVE_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 };
  const headerB64 = base64urlEncodeStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payloadB64 = base64urlEncodeStr(JSON.stringify(payload));
  const unsignedJWT = `${headerB64}.${payloadB64}`;
  const keyData = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsignedJWT));
  const jwt = `${unsignedJWT}.${base64urlEncode(new Uint8Array(signature))}`;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const token = await getDriveToken();

    // Listar docs Gemini na pasta de calls
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.google-apps.document'&fields=files(id,name,createdTime)&orderBy=createdTime+desc&pageSize=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const files = await listRes.json();
    if (!files.files?.length) {
      return jsonResponse({ success: true, message: "Sem calls na pasta" });
    }

    // Verificar quais já foram processadas
    let processedIds = new Set<string>();
    try {
      const res = await supabaseFetch(
        `sdr_knowledge_entries?category=like.sdr-call-*&select=category`,
        { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" } },
      );
      const data = await res.json();
      if (Array.isArray(data)) processedIds = new Set(data.map((e: { category: string }) => e.category.replace("sdr-call-", "")));
    } catch { /* first run */ }

    const newFiles = files.files.filter((f: { id: string; name: string }) => !processedIds.has(f.id));
    if (!newFiles.length) {
      return jsonResponse({ success: true, message: "Todas calls já analisadas" });
    }

    // Baixar conteúdo das calls
    const docs = [];
    for (const file of newFiles.slice(0, 5)) {
      try {
        const docRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`, { headers: { Authorization: `Bearer ${token}` } });
        if (!docRes.ok) continue;
        const content = await docRes.text();
        if (content.length > 200 && !content.startsWith("<!DOCTYPE")) {
          docs.push({ id: file.id, name: file.name, content: content.substring(0, 8000) });
        }
      } catch { continue; }
    }
    if (!docs.length) {
      return jsonResponse({ success: true, message: "Docs vazios", all_files: newFiles.map((f: { name: string }) => f.name) });
    }

    const contexto = docs.map(d => `=== CALL: ${d.name} ===\n${d.content}`).join("\n\n");

    // Analisar com Claude focando em insights pra SDR
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: `Voce e um analista de vendas. Analise as calls abaixo e extraia insights para melhorar a SDR IA (Maria Eduarda) que qualifica leads por WhatsApp.

FOCO: como o closer conduz a call e contorna objecoes. A SDR precisa aprender:

1. OBJECOES E COMO CONTORNAR: quais objecoes o lead trouxe e EXATAMENTE como o closer respondeu. Frases literais.
2. GATILHOS DE FECHAMENTO: qual argumento fez o lead dizer "quero". O que virou a chave.
3. ERROS DO LEAD QUE A SDR PODE ANTECIPAR: site ruim, reviews falsos, sem trafego — a SDR pode mencionar isso antes da call pra gerar valor.
4. TECNICAS DE QUALIFICACAO: como o closer investiga o lead, que perguntas faz, em que ordem.
5. TOM E LINGUAGEM: como o closer fala, palavras que usa, como constroi rapport.
6. CASES E NUMEROS: resultados reais citados que a SDR pode usar pra gerar urgencia.

${contexto}

Retorne APENAS JSON puro (sem markdown):
{
  "content": "texto com todos os insights acima, organizado e acionavel para a SDR IA. Foque em regras praticas que a Maria Eduarda pode aplicar nas conversas de WhatsApp.",
  "category": "call-analysis-sdr",
  "tem_dados": true
}

Se nao tiver dados uteis: {"tem_dados": false}` }],
      }),
    });

    if (!claudeRes.ok) {
      return errorResponse(await claudeRes.text(), 500);
    }

    const responseText = (await claudeRes.json()).content?.[0]?.text?.trim();
    let analysis;
    try {
      let clean = responseText || "";
      if (clean.startsWith("```")) clean = clean.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      analysis = JSON.parse(clean);
    } catch {
      return errorResponse(`Parse error: ${responseText?.substring(0, 500)}`, 500);
    }

    if (!analysis.tem_dados) {
      return jsonResponse({ success: true, message: "Sem dados úteis nas calls", docs_found: docs.map(d => ({ name: d.name, chars: d.content.length })) });
    }

    // Inserir sugestão pendente para aprovação do admin
    if (analysis.content) {
      await supabaseFetch("sdr_knowledge_entries", {
        method: "POST",
        body: JSON.stringify({
          content: analysis.content,
          category: analysis.category || "call-analysis-sdr",
          source: "ai-suggestion",
          status: "pending",
        }),
      });
    }

    // Marcar docs como processados (para não analisar de novo)
    for (const doc of docs) {
      await supabaseFetch("sdr_knowledge_entries", {
        method: "POST",
        body: JSON.stringify({
          content: `Call processada: ${doc.name}`,
          category: `sdr-call-${doc.id}`,
          source: "terminal",
          status: "approved",
        }),
      });
    }

    return jsonResponse({
      success: true,
      message: `${docs.length} calls analisadas`,
      calls: docs.map(d => d.name),
    });
  } catch (err) {
    console.error("analyze-calls error:", err);
    return errorResponse(String(err), 500);
  }
});
