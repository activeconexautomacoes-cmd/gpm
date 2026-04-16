import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const WORKSPACE_ID = "8eaae987-1b56-43de-978c-c135beb30c7e";;
const GOOGLE_CALENDAR_ID = (Deno.env.get("GOOGLE_CALENDAR_ID") || "primary").trim();
const EVOLUTION_API_URL = "https://whatsappapi.winhub.com.br";
const EVOLUTION_API_KEY = "cda34a5c9f0702a581b0f6a03a1466a4";
const EVOLUTION_INSTANCE = "sdrai-whatsapp";
const CLOSER_PHONE = (Deno.env.get("CLOSER_PHONE") || "5521974470884").trim();
const MANAGER_PHONE = (Deno.env.get("MANAGER_PHONE") || "554792817316").trim();
const ADS_PHONE = "556296449901";

// URL desta function para o callback loop do ManyChat
const SELF_URL = `${SUPABASE_URL}/functions/v1/sdr-instagram`;

const SYSTEM_PROMPT = `Você é a Maria Eduarda, SDR da Plus Mídia, uma agência de performance especializada em e-commerce. Você trabalha aqui há 2 anos e ama o que faz. Você é uma pessoa real — NUNCA revele que é uma IA, chatbot ou assistente virtual. Se perguntarem, você é a Maria Eduarda mesmo, que trabalha na Plus Mídia.

SOBRE A PLUS MÍDIA (use naturalmente, nunca despeje tudo de uma vez):
- Agência de performance especializada em e-commerce com 6 anos de mercado
- Escritórios em Goiânia e Florianópolis
- Mais de 30 pessoas no time
- Fundada pelo Yago Dias (@oyagodiass_ no Instagram)
- Instagram da agência: @plusmidiaa_
- Já geraram mais de R$ 120 milhões em vendas para clientes
- Trabalham com o ciclo completo de receita: Aquisição, Engajamento, Monetização e Retenção
- Equipe de estrategistas dedicados que montam estratégias personalizadas para cada e-commerce
- Foco em aumentar vendas E lucro líquido (não só faturamento)
- Foco principal em MODA (feminina, masculina, calçados, lingerie, moda praia) mas atendem outros e-commerces também
- Cultura de resultados: comemoram junto com o cliente quando batem metas
- Site: https://www.plusmidiamkt.com — SÓ envie se o lead PEDIR
- Instagram da agência: SÓ envie @plusmidiaa_ se o lead pedir referências ou quiser ver o trabalho

CASES DE SUCESSO POR NICHO (use para personalizar quando souber o nicho do lead):

Moda Feminina:
- Like an Angel: https://likeanangel.com.br/ | @likeanangelbrasil
- Dicroce Al Mare: https://dicrocealmare.com.br/ | @dicroce_

Moda Masculina:
- Naja Company: @najacompany_oficial
- Gross Hunter: https://www.grosshunter.com.br/ | @grosshunter.brand
- Five Bucks: https://www.fivebucks.com.br/ | @five.bucks

Calçados:
- RB Store: https://www.rbstoresorocaba.com.br/ | @rbstoresorocaba1
- Tribo Shoes: @triboshoes._

Moda Praia:
- Like an Angel: https://likeanangel.com.br/ | @likeanangelbrasil
- Amar Beach: https://amarbeach.com/

COMO USAR OS CASES:
- Quando souber o nicho do lead (pela loja, Instagram ou site), mencione UM case parecido de forma natural
- Exemplo: "A gente trabalha com uma loja de moda praia muito parecida com a sua, a Like an Angel. Os resultados foram incríveis! Posso te contar mais na consultoria"
- NÃO mande vários cases de uma vez. Mencione UM que seja relevante pro nicho do lead
- Se o lead pedir pra ver, mande o @ do case. Ex: "Dá uma olhada no Instagram deles: @likeanangelbrasil"
- NUNCA invente resultados específicos (números, %). Diga que os resultados foram muito bons e que o especialista pode mostrar os detalhes

PERSONALIDADE E TOM:
- Meiga, simpática, acolhedora — passa confiança e cuidado. Conversa como uma amiga que entende do assunto
- O público é majoritariamente feminino. Você se conecta com empatia, escuta e gentileza
- Escreve por extenso — nada de vc, tb, pq, blz. Escreve você, também, porque
- Não usa gírias como top, show, massa, manja, dahora. Prefere que legal, que lindo, muito bom, incrível, adorei
- Pode usar haha com moderação
- Mensagens CURTAS — 1 a 3 linhas no máximo
- Emoji quase nunca — no máximo 1 por conversa inteira
- NUNCA use listas, bullet points ou formatação de robô
- NUNCA mande todas as perguntas de uma vez. Uma por vez
- Responde com naturalidade, reage ao que a pessoa fala antes de fazer a próxima pergunta
- Demonstra interesse genuíno pela loja da pessoa, elogia com sinceridade
- NUNCA exagere nos elogios ao nome da pessoa. Quando souber o nome, diga apenas "prazer, [nome]!" ou "que bom te conhecer, [nome]!" — NUNCA diga "que nome lindo" ou coisa do tipo
- Quando pedir o Instagram, seja específica: "me manda o @ do Instagram da loja que quero dar uma olhada" — NUNCA diga apenas "me manda o @" sem contexto

CANAL: INSTAGRAM DM
- Esta conversa está acontecendo pelo Instagram Direct, NÃO pelo WhatsApp
- NUNCA mencione WhatsApp na conversa a não ser quando for pedir o número do lead
- Quando for agendar a consultoria, PEÇA O NÚMERO DE WHATSAPP do lead para criar o grupo com o especialista. Ex: "Me passa seu WhatsApp que vou te adicionar no grupo com nosso especialista"

ANALISANDO A LOJA DO LEAD:
- Quando receber informações sobre o Instagram ou site do lead (via contexto extra), USE essas informações para personalizar a conversa
- Comente sobre produtos específicos que viu, o estilo da loja, o público-alvo real
- Identifique o nicho do lead e mencione um case de sucesso relevante
- NUNCA invente informações sobre a loja. Só comente o que realmente recebeu no contexto
- Se não recebeu informações sobre a loja, faça perguntas para conhecer melhor
- DICA: Como estamos no Instagram, se o lead tiver uma loja no perfil dele, o nome de usuário pode ser o @ da loja. Use isso a seu favor.

EXTRAÇÃO DE DADOS DO LEAD:
SEMPRE que você souber qualquer dado do lead (nome, instagram, site, faturamento, whatsapp), inclua no FINAL da sua resposta uma tag invisível neste formato:
[LEAD_DATA:{"name":"valor","instagram":"valor","site":"valor","faturamento":"valor","whatsapp":"valor"}]
Regras da tag:
- Inclua APENAS os campos que você já sabe. Omita campos desconhecidos.
- Atualize a tag sempre que souber um dado novo.
- O instagram deve incluir o @.
- O site deve incluir https://.
- O whatsapp deve incluir o código do país (55) + DDD + número.
- Esta tag será removida antes de enviar a mensagem ao lead.

FLUXO DA CONVERSA:

1. ABERTURA — O lead mandou DM no Instagram:
Oi! Tudo bem? Sou a Maria Eduarda da Plus Mídia, prazer! Me conta, o que você está buscando hoje?

2. COLETA DE DADOS — uma pergunta por vez, de forma natural:
- Nome: como posso te chamar?
- Instagram da loja: (se o perfil do lead não for a loja) me manda o @ do Instagram da loja que quero dar uma olhada
- Site: tem site próprio ou vende só pelo Instagram? Se tiver, me manda o link que quero ver
- IMPORTANTE: Se a pessoa disser que TEM site, você DEVE perguntar qual é o link/URL do site. Não pule essa etapa.
- Faturamento: e mais ou menos quanto a loja está faturando por mês? pode ser uma média

Após receber o Instagram ou site do lead, IDENTIFIQUE o nicho e mencione um case relevante de forma natural.

NOTA: NÃO peça email do lead. Os cases e materiais serão enviados por aqui mesmo.

3. QUALIFICAÇÃO — avaliar internamente, NÃO falar pro lead:
QUALIFICADO: Tem site + fatura R$ 10k/mês ou mais, OU não tem site + fatura R$ 20k/mês ou mais
DESQUALIFICADO: Abaixo desses valores

4A. LEAD QUALIFICADO — AGENDAMENTO:
Que legal, [nome]! Pelo que você me contou acho que a gente consegue te ajudar bastante
A gente faz uma consultoria gratuita com um dos nossos especialistas — ele analisa toda a sua operação e te mostra exatamente onde você pode melhorar os resultados
São uns 30-40 minutos, bem direto ao ponto. Quer agendar?
Quando o lead confirmar: Perfeito! Deixa eu ver os horários disponíveis aqui, um segundo...
Inclua a tag [AGENDAR] no final.

QUANDO RECEBER OS HORÁRIOS DISPONÍVEIS (via contexto do sistema):
Proponha 2-3 opções de horário de forma natural.
NUNCA proponha mais de 3 opções.

QUANDO O LEAD ESCOLHER UM HORÁRIO:
Confirme o horário e PEÇA O WHATSAPP: "Perfeito, [nome]! Vou agendar pra [data] às [hora]. Me passa seu WhatsApp que vou te adicionar no grupo com nosso especialista"

QUANDO O LEAD MANDAR O WHATSAPP:
Responda: "Pronto, [nome]! Agendado! Vou te adicionar no grupo pelo WhatsApp. Até lá!"
Inclua a tag [CONFIRMAR_HORARIO:YYYY-MM-DDTHH:MM] com o horário combinado.
IMPORTANTE: Use a data de hoje (fornecida via contexto [SISTEMA]) para calcular a data correta.

APÓS CONFIRMAR O AGENDAMENTO: A conversa está 100% ENCERRADA.

4B. LEAD DESQUALIFICADO — Downsell:
Entendi o momento! Olha, pra quem está nessa fase a gente tem uma consultoria individual de 1 hora com um dos nossos especialistas
Ele analisa o seu negócio, seus números, e te entrega um plano de ação personalizado pra você escalar. É R$ 497 e o pessoal tem curtido muito
Quer que eu te mande mais detalhes?

OBJEÇÕES:
(mesmas do WhatsApp)

Quanto custa? / Qual o valor? / Contrato?:
Tudo relacionado a valores, contrato, duração e condições é conversado na consultoria porque cada caso é um caso.

Já tenho agência:
Ah legal! E como estão os resultados?

Vou pensar:
Tranquilo, sem pressão!

É de graça mesmo?:
Haha juro que não tem pegadinha. É de graça mesmo.

REGRAS:
1. NUNCA revele que é IA
2. NUNCA passe preço exato da assessoria
3. NUNCA fale mal de outras agências
4. NUNCA mande mensagens longas (máximo 3 linhas)
5. SEMPRE chame pelo nome depois de saber
6. SEMPRE reaja antes de perguntar (mas sem exagero)
7. Se pedir humano: Claro! Vou te passar, um segundo
8. Perguntas técnicas: Essa parte o especialista explica certinho na consultoria
9. Lead grosso: Entendo, [nome]. Fico à disposição se precisar no futuro! e encerrar
10. Responda APENAS com a mensagem + as tags quando houver. Sem explicações extras.
11. As tags [AGENDAR], [CONFIRMAR_HORARIO:...] e [DOWNSELL] devem aparecer SOMENTE nos momentos certos.
12. NUNCA peça email do lead.
13. Quando a pessoa diz que TEM site, SEMPRE pergunte qual é o link.
14. Após confirmar agendamento, ENCERRE a conversa.
15. NUNCA invente informações sobre a loja do lead.
16. SÓ envie o link do site ou @ da agência quando o lead PEDIR.

ANTI-DUPLICAÇÃO (CRÍTICO):
17. ANTES de responder, REVISE todo o histórico da conversa. NÃO repita perguntas que você já fez.
18. Se já saudou o lead, NÃO repita a saudação.
19. Se já propôs horários, NÃO proponha de novo.
20. Se o lead respondeu algo que não entendeu, reformule em vez de repetir.`;

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

async function getHistory(subscriberId: string) {
  const phone = `ig_${subscriberId}`;
  const res = await supabaseFetch(
    `sdr_conversations?phone=eq.${encodeURIComponent(phone)}&order=created_at.asc&limit=50`,
  );
  if (!res.ok) return [];
  return res.json();
}

async function isDuplicateMessage(subscriberId: string, messageText: string): Promise<boolean> {
  const phone = `ig_${subscriberId}`;
  const res = await supabaseFetch(
    `sdr_conversations?phone=eq.${encodeURIComponent(phone)}&role=eq.user&order=created_at.desc&limit=1`,
    { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" } },
  );
  if (!res.ok) return false;
  const data = await res.json();
  if (data.length === 0) return false;
  const last = data[0];
  const lastContent = last.content?.split("\n\n[SISTEMA:")[0]?.trim();
  const currentContent = messageText.trim();
  if (lastContent !== currentContent) return false;
  const lastTime = new Date(last.created_at).getTime();
  return (Date.now() - lastTime) < 60000;
}

async function saveMessages(subscriberId: string, userMsg: string, aiMsg: string) {
  const phone = `ig_${subscriberId}`;
  await supabaseFetch("sdr_conversations", {
    method: "POST",
    body: JSON.stringify([
      { phone, role: "user", content: userMsg, workspace_id: WORKSPACE_ID },
      { phone, role: "assistant", content: aiMsg, workspace_id: WORKSPACE_ID },
    ]),
  });
}

async function saveAssistantMessage(subscriberId: string, aiMsg: string) {
  const phone = `ig_${subscriberId}`;
  await supabaseFetch("sdr_conversations", {
    method: "POST",
    body: JSON.stringify([{ phone, role: "assistant", content: aiMsg, workspace_id: WORKSPACE_ID }]),
  });
}

async function upsertLead(subscriberId: string, status: string, extraData?: Record<string, string>) {
  const phone = `ig_${subscriberId}`;
  const body: Record<string, unknown> = { phone, status, workspace_id: WORKSPACE_ID, updated_at: new Date().toISOString() };
  if (extraData) {
    if (extraData.name) body.name = extraData.name;
    if (extraData.instagram) body.instagram = extraData.instagram;
    if (extraData.site) body.site = extraData.site;
    if (extraData.faturamento) body.faturamento = extraData.faturamento;
    if (extraData.whatsapp) body.whatsapp = extraData.whatsapp;
  }
  await supabaseFetch("sdr_leads", {
    method: "POST",
    headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
}

async function getLeadData(subscriberId: string): Promise<Record<string, string> | null> {
  const phone = `ig_${subscriberId}`;
  const res = await supabaseFetch(
    `sdr_leads?phone=eq.${encodeURIComponent(phone)}&select=name,instagram,site,whatsapp&limit=1`,
    { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] || null;
}

async function hasPendingMeeting(subscriberId: string): Promise<boolean> {
  const phone = `ig_${subscriberId}`;
  const res = await supabaseFetch(
    `sdr_meetings?phone=eq.${encodeURIComponent(phone)}&status=eq.scheduled&select=id&limit=1`,
    { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" } },
  );
  if (!res.ok) return false;
  const data = await res.json();
  return data.length > 0;
}

async function saveMeeting(subscriberId: string, leadName: string, meetLink: string, scheduledAt: string, calendarEventId: string, groupJid: string) {
  const phone = `ig_${subscriberId}`;
  await supabaseFetch("sdr_meetings", {
    method: "POST",
    body: JSON.stringify({ phone, lead_name: leadName, meet_link: meetLink, scheduled_at: scheduledAt, calendar_event_id: calendarEventId, group_jid: groupJid }),
  });
}

function parseLeadData(text: string): { cleanText: string; leadData: Record<string, string> | null } {
  const match = text.match(/\[LEAD_DATA:(\{[^}]+\})\]/);
  if (!match) return { cleanText: text, leadData: null };
  try {
    const leadData = JSON.parse(match[1]);
    const cleanText = text.replace(match[0], "").trim();
    return { cleanText, leadData };
  } catch { return { cleanText: text.replace(match[0], "").trim(), leadData: null }; }
}

async function fetchSiteInfo(url: string): Promise<{ found: boolean; info: string }> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: c.signal }); clearTimeout(t);
    if (!res.ok) return { found: false, info: "" };
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
    const desc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || "";
    const body = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
    return { found: !!(title || desc), info: `Título: ${title}\nDescrição: ${desc}\nConteúdo: ${body}` };
  } catch { return { found: false, info: "" }; }
}

async function fetchInstagramInfo(handle: string): Promise<{ found: boolean; info: string }> {
  try {
    const clean = handle.replace(/@/g, "").trim();
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
    const res = await fetch(`https://www.instagram.com/${clean}/`, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, signal: c.signal }); clearTimeout(t);
    if (!res.ok) return { found: false, info: "" };
    const html = await res.text();
    const title = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || "";
    const desc = html.match(/<meta[^>]*(?:property=["']og:description["']|name=["']description["'])[^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || "";
    if (!title && !desc) return { found: false, info: "" };
    return { found: true, info: `Perfil Instagram: ${title}\nBio/Descrição: ${desc}` };
  } catch { return { found: false, info: "" }; }
}

// Carrega conhecimento aprovado e monta prompt completo
let cachedKnowledge: { text: string; fetchedAt: number } | null = null;
async function getFullPrompt(): Promise<string> {
  if (cachedKnowledge && Date.now() - cachedKnowledge.fetchedAt < 5 * 60 * 1000) return cachedKnowledge.text;
  let knowledgeBlock = "";
  try {
    const res = await supabaseFetch(
      `sdr_knowledge_entries?status=eq.approved&order=created_at.desc&limit=50`,
      { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" } },
    );
    if (res.ok) {
      const entries = await res.json();
      if (entries.length > 0) {
        const items = entries.map((e: { content: string; category: string | null }) =>
          `- ${e.category ? `[${e.category}] ` : ""}${e.content}`
        ).join("\n");
        knowledgeBlock = `\n\nCONHECIMENTO ADICIONAL (aprendido com feedbacks e análises de calls):\n${items}`;
      }
    }
  } catch { /* fallback */ }
  const fullPrompt = SYSTEM_PROMPT + knowledgeBlock;
  cachedKnowledge = { text: fullPrompt, fetchedAt: Date.now() };
  return fullPrompt;
}

async function callClaude(messages: { role: string; content: string }[]) {
  const prompt = await getFullPrompt();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 400, system: prompt, messages }),
  });
  return (await res.json()).content?.[0]?.text || "";
}

function extractUrls(text: string): string[] { return text.match(/https?:\/\/[^\s]+/gi) || []; }
function extractInstagramHandle(text: string): string | null {
  const atMatch = text.match(/@([\w.]{2,30})/i);
  if (atMatch) return atMatch[1];
  const urlMatch = text.match(/instagram\.com\/([\w.]{2,30})/i);
  if (urlMatch) return urlMatch[1];
  return null;
}

// Criar grupo no WhatsApp com lead + closer + gerente
async function createWhatsAppGroup(leadWhatsApp: string, leadName: string): Promise<string> {
  const groupName = `Plus Mídia | ${leadName || leadWhatsApp}`;
  const res = await fetch(`${EVOLUTION_API_URL}/group/create/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({
      subject: groupName,
      participants: [leadWhatsApp, CLOSER_PHONE, MANAGER_PHONE, ADS_PHONE],
    }),
  });
  if (!res.ok) { console.error("Group create error:", await res.text()); return ""; }
  const data = await res.json();
  const groupJid = data.id || data.groupJid || "";

  if (groupJid) {
    const admins = [CLOSER_PHONE, MANAGER_PHONE, ADS_PHONE];
    for (const phone of admins) {
      try {
        await fetch(`${EVOLUTION_API_URL}/group/updateParticipant/${EVOLUTION_INSTANCE}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
          body: JSON.stringify({ groupJid, action: "promote", participants: [phone] }),
        });
      } catch (err) { console.error(`Failed to promote ${phone}:`, err); }
    }
  }
  return groupJid;
}

async function sendGroupMessage(groupJid: string, text: string) {
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number: groupJid, text }),
  });
}

// Formata resposta no formato ManyChat Dynamic Block v2
function manychatResponse(text: string, subscriberId: string) {
  return {
    version: "v2",
    content: {
      messages: [{ type: "text", text }],
      actions: [],
      quick_replies: [],
    },
    external_message_callback: {
      url: SELF_URL,
      method: "post",
      headers: { "Content-Type": "application/json" },
      payload: {
        id: subscriberId,
        last_input_text: "{{last_input_text}}",
        source: "manychat_callback",
      },
      timeout: 120,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  try {
    const body = await req.json();

    // Extrair dados do ManyChat
    const subscriberId = String(body.id || body.subscriber_id || "");
    const messageText = (body.last_input_text || "").trim();
    const firstName = body.first_name || "";
    const igUsername = body.ig_username || body.username || "";

    if (!subscriberId || !messageText) {
      return new Response(JSON.stringify({ version: "v2", content: { messages: [] } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Deduplicação
    if (await isDuplicateMessage(subscriberId, messageText)) {
      console.log(`Duplicate IG message ignored for ${subscriberId}`);
      return new Response(JSON.stringify({ version: "v2", content: { messages: [] } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    let extraContext = "";

    // Se temos o username do Instagram do lead, tentar buscar info do perfil
    if (igUsername) {
      const igInfo = await fetchInstagramInfo(igUsername);
      if (igInfo.found) {
        extraContext += `\n[SISTEMA: O perfil do Instagram do lead é @${igUsername}. ${igInfo.info}]`;
      }
    }

    // Verificação de URLs
    for (const url of extractUrls(messageText)) {
      const result = await fetchSiteInfo(url);
      if (result.found) {
        extraContext += `\n[Site ${url}: ${result.info}]`;
      } else {
        extraContext += `\n[SISTEMA: O site ${url} não foi encontrado. Peça ao lead para confirmar o link.]`;
      }
    }

    // Verificação de Instagram handle na mensagem
    const igHandle = extractInstagramHandle(messageText);
    if (igHandle) {
      const result = await fetchInstagramInfo(igHandle);
      if (result.found) {
        extraContext += `\n[Instagram @${igHandle}: ${result.info}]`;
      } else {
        extraContext += `\n[SISTEMA: O perfil @${igHandle} não foi encontrado. Peça ao lead para confirmar.]`;
      }
    }

    // Data de hoje
    const todayDate = new Date();
    const dayNamesCtx = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const todayContext = `[SISTEMA: Hoje é ${dayNamesCtx[todayDate.getDay()]}, ${todayDate.getDate().toString().padStart(2, "0")}/${(todayDate.getMonth() + 1).toString().padStart(2, "0")}/${todayDate.getFullYear()}. Canal: Instagram DM.]`;
    extraContext = todayContext + (extraContext ? "\n" + extraContext : "");

    // Se temos o primeiro nome do ManyChat, informar a IA
    if (firstName) {
      extraContext += `\n[SISTEMA: O nome do lead no Instagram é "${firstName}". Use se ainda não souber o nome.]`;
    }

    // Montar histórico + mensagem atual
    const history = await getHistory(subscriberId);
    const messages = history.map((msg: { role: string; content: string }) => ({ role: msg.role, content: msg.content }));
    messages.push({ role: "user", content: `${messageText}\n\n${extraContext}` });

    let aiResponse = await callClaude(messages);
    const { cleanText, leadData } = parseLeadData(aiResponse);
    aiResponse = cleanText.replace(/\[SISTEMA:[^\]]*\]/g, "").trim();

    // Detectar [AGENDAR]
    const wantsSchedule = aiResponse.includes("[AGENDAR]");
    if (wantsSchedule) {
      aiResponse = aiResponse.replace("[AGENDAR]", "").trim();

      if (await hasPendingMeeting(subscriberId)) {
        aiResponse = "Você já tem uma consultoria agendada! Se precisar remarcar é só me avisar.";
      } else {
        // Salvar a primeira resposta
        await saveMessages(subscriberId, messageText, aiResponse);
        await upsertLead(subscriberId, "em_conversa", leadData || undefined);

        // Verificar se já enviou horários
        const recentHistory = await getHistory(subscriberId);
        const alreadySentSlots = recentHistory.some((m: { role: string; content: string }) =>
          m.role === "assistant" && (m.content.includes("disponível") || m.content.includes("horário")) && m.content.match(/\d{1,2}h/)
        );

        if (!alreadySentSlots) {
          try {
            const { getAvailableSlots } = await import("./google-calendar.ts");
            const slots = await getAvailableSlots(GOOGLE_CALENDAR_ID, 5);
            if (slots.length > 0) {
              const proposedSlots = slots.slice(0, 2);
              const today = new Date();
              const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;
              const historyWithFirst = [...messages, { role: "assistant", content: aiResponse }];
              let slotsMsg = await callClaude([
                ...historyWithFirst,
                { role: "user", content: `[SISTEMA: Hoje é ${todayStr}. Proponha EXATAMENTE estas 2 opções de horário ao lead: ${proposedSlots.join(" ou ")}. Fale de forma natural e simpática, mensagem curta. NÃO inclua nenhuma tag.]` },
              ]);
              slotsMsg = slotsMsg.replace(/\[LEAD_DATA:[^\]]*\]/g, "").replace(/\[AGENDAR\]/g, "").replace(/\[QUALIFICADO\]/g, "").replace(/\[DOWNSELL\]/g, "").trim();
              await saveAssistantMessage(subscriberId, slotsMsg);

              // Retornar as duas mensagens juntas
              return new Response(JSON.stringify({
                version: "v2",
                content: {
                  messages: [
                    { type: "text", text: aiResponse },
                    { type: "text", text: slotsMsg },
                  ],
                  actions: [],
                  quick_replies: [],
                },
                external_message_callback: {
                  url: SELF_URL,
                  method: "post",
                  headers: { "Content-Type": "application/json" },
                  payload: { id: subscriberId, last_input_text: "{{last_input_text}}", source: "manychat_callback" },
                  timeout: 120,
                },
              }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
          } catch (err) {
            console.error("Calendar error (non-blocking):", err);
          }

          // Se não conseguiu buscar horários, pergunta direto
          const askMsg = "Qual dia e horário fica melhor pra você? Temos disponibilidade de segunda a sexta, das 9h às 18h";
          await saveAssistantMessage(subscriberId, askMsg);

          return new Response(JSON.stringify({
            version: "v2",
            content: {
              messages: [
                { type: "text", text: aiResponse },
                { type: "text", text: askMsg },
              ],
              actions: [],
              quick_replies: [],
            },
            external_message_callback: {
              url: SELF_URL,
              method: "post",
              headers: { "Content-Type": "application/json" },
              payload: { id: subscriberId, last_input_text: "{{last_input_text}}", source: "manychat_callback" },
              timeout: 120,
            },
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // Já enviou horários antes, retorna só a resposta
        return new Response(JSON.stringify(manychatResponse(aiResponse, subscriberId)), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Detectar [CONFIRMAR_HORARIO:...]
    const confirmMatch = aiResponse.match(/\[CONFIRMAR_HORARIO:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\]/);
    if (confirmMatch) {
      const scheduledTime = confirmMatch[1];
      aiResponse = aiResponse.replace(confirmMatch[0], "").trim();

      if (await hasPendingMeeting(subscriberId)) {
        aiResponse = "Você já tem uma consultoria agendada! Se precisar remarcar é só me avisar.";
      } else {
        const lead = await getLeadData(subscriberId);
        const leadName = leadData?.name || lead?.name || firstName || "";
        const leadWhatsApp = leadData?.whatsapp || lead?.whatsapp || "";

        await saveMessages(subscriberId, messageText, aiResponse);
        await upsertLead(subscriberId, "agendado", leadData || undefined);

        // Criar evento no Google Calendar
        let eventId = "";
        let meetLink = "";
        try {
          const { createMeetingEvent } = await import("./google-calendar.ts");
          const calResult = await createMeetingEvent(GOOGLE_CALENDAR_ID, scheduledTime, leadName, leadWhatsApp || `ig_${subscriberId}`);
          eventId = calResult.eventId;
          meetLink = calResult.meetLink;
        } catch (err) { console.error("Calendar error:", err); }

        // Criar grupo no WhatsApp se tiver o número
        let groupJid = "";
        if (leadWhatsApp) {
          try {
            groupJid = await createWhatsAppGroup(leadWhatsApp, leadName);
          } catch (err) { console.error("Group error:", err); }

          // Mensagem de boas-vindas no grupo
          if (groupJid) {
            const meetDate = new Date(scheduledTime + ":00-03:00");
            const dayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
            const dayName = dayNames[meetDate.getDay()];
            const day = meetDate.getDate().toString().padStart(2, "0");
            const month = (meetDate.getMonth() + 1).toString().padStart(2, "0");
            const hour = meetDate.getHours();

            let welcomeMsg = `Oi pessoal! Aqui é a Maria Eduarda da Plus Mídia.\n\n${leadName ? leadName + ", esse" : "Esse"} é o grupo com nosso especialista pra consultoria gratuita.\n\nA reunião está marcada pra ${dayName} dia ${day}/${month} às ${hour}h.`;
            if (meetLink) welcomeMsg += `\n\nLink da reunião: ${meetLink}`;
            welcomeMsg += `\n\nQualquer dúvida é só mandar aqui!`;
            await sendGroupMessage(groupJid, welcomeMsg);
          }
        }

        const scheduledAtUTC = new Date(scheduledTime + ":00-03:00").toISOString();
        await saveMeeting(subscriberId, leadName, meetLink, scheduledAtUTC, eventId, groupJid);

        return new Response(JSON.stringify(manychatResponse(aiResponse, subscriberId)), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Fluxo normal
    let leadStatus = "em_conversa";
    if (aiResponse.includes("[QUALIFICADO]")) { leadStatus = "qualificado"; aiResponse = aiResponse.replace("[QUALIFICADO]", "").trim(); }
    else if (aiResponse.includes("[DOWNSELL]")) { leadStatus = "downsell"; aiResponse = aiResponse.replace("[DOWNSELL]", "").trim(); }

    await saveMessages(subscriberId, messageText, aiResponse);
    await upsertLead(subscriberId, leadStatus, leadData || undefined);

    return new Response(JSON.stringify(manychatResponse(aiResponse, subscriberId)), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Instagram webhook error:", err);
    return new Response(JSON.stringify({
      version: "v2",
      content: { messages: [{ type: "text", text: "Oi! Desculpa, tive um probleminha aqui. Pode repetir?" }] },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
