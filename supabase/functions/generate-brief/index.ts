import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { siteUrl, promotion, formats, additionalText, requestId } = await req.json();

    if (!siteUrl || !promotion || !formats?.length || !requestId) {
      throw new Error("Missing required fields: siteUrl, promotion, formats, requestId");
    }

    // ─── 1. Check site_brands cache ──────────────────────

    let brandData: Record<string, unknown> | null = null;

    const { data: cachedBrand } = await supabase
      .from("site_brands")
      .select("*")
      .eq("site_url", siteUrl)
      .single();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    if (cachedBrand && cachedBrand.updated_at > sevenDaysAgo) {
      brandData = cachedBrand.brand_data;
    } else {
      // ─── 2. Scrape the site ──────────────────────────────

      brandData = await scrapeSite(siteUrl);

      // Save/update cache
      if (cachedBrand) {
        await supabase
          .from("site_brands")
          .update({ brand_data: brandData, updated_at: new Date().toISOString() })
          .eq("id", cachedBrand.id);
      } else {
        await supabase
          .from("site_brands")
          .insert({ site_url: siteUrl, brand_data: brandData });
      }
    }

    // ─── 3. Generate briefs via Claude API ───────────────

    const formatList = formats
      .map((f: any) => `- ${f.name} (${f.width}x${f.height}px)`)
      .join("\n");

    const systemPrompt = `Você é uma diretora criativa sênior de uma agência de marketing digital brasileira.
Sua função é analisar dados de um site e gerar um brief EXTREMAMENTE detalhado para cada formato de arte solicitado.
O designer deve conseguir executar a arte seguindo APENAS o seu brief, sem precisar tomar nenhuma decisão criativa.

IMPORTANTE: A sua função NÃO é gerar a arte. Você gera INSTRUÇÕES DETALHADAS para que o designer humano crie a arte.

REGRA CRÍTICA SOBRE CORES:
- O campo "paletaCores" contém EXATAMENTE 3 cores extraídas do site:
  - 1ª cor: cor de fundo predominante do site
  - 2ª cor: cor de destaque principal (textos premium, detalhes, elementos de marca)
  - 3ª cor: cor de destaque secundária (CTAs, botões, chamadas de ação)
- A paleta do brief DEVE usar EXATAMENTE essas 3 cores. Nenhuma a mais, nenhuma a menos.
- Pode usar preto (#000000) para texto de corpo se necessário, mas as cores de identidade são SOMENTE as 3 do "paletaCores".
- NÃO invente cores. NÃO adicione outras cores.

Responda SEMPRE em português brasileiro.
Responda SEMPRE em JSON válido, sem markdown code blocks, sem texto antes ou depois do JSON.`;

    // Extract first 3 products for explicit injection into prompt
    const siteProducts = (brandData as any)?.produtosDoSite || [];
    const top3Products = siteProducts.slice(0, 3);
    const productsText = top3Products.length > 0
      ? top3Products.map((p: any, i: number) => `  ${i + 1}. Nome: "${p.nome}" | Link: "${p.link}"`).join("\n")
      : "  Nenhum produto encontrado no site.";

    // Extract fonts for explicit injection
    const siteFonts = (brandData as any)?.fonts || [];
    const fontsText = siteFonts.length > 0
      ? siteFonts.map((f: string, i: number) => `  ${i + 1}. ${f}`).join("\n")
      : "  Nenhuma fonte identificada.";

    const userPrompt = `Analise os dados do site abaixo e gere um brief detalhado para cada formato solicitado.

DADOS DO SITE:
${JSON.stringify(brandData, null, 2)}

OS 3 PRIMEIROS PRODUTOS DO SITE (USE EXATAMENTE ESTES):
${productsText}

FONTES/TIPOGRAFIA DO SITE (USE EXATAMENTE ESTAS):
${fontsText}

PROMOÇÃO/OFERTA:
${promotion}

${additionalText ? `SUGESTÃO/OBSERVAÇÃO DO GESTOR (PRIORIDADE MÁXIMA):\n"${additionalText}"\nATENÇÃO: O gestor escreveu uma sugestão acima. O brief INTEIRO deve se basear nessa sugestão. Se o gestor pediu um estilo, use esse estilo. Se deu uma ideia de layout, siga essa ideia. Se sugeriu um conceito, o conceito visual deve partir disso. A sugestão do gestor tem PRIORIDADE sobre qualquer outra decisão criativa.\n` : ""}

FORMATOS SOLICITADOS:
${formatList}

Gere um JSON com a seguinte estrutura (um brief por formato):
{
  "briefs": {
    "<format_id>": {
      "paleta_cores": [
        { "hex": "#XXXXXX", "nome": "Nome da cor", "uso": "Onde usar esta cor" }
      ],
      "tipografia": {
        "titulo": "Descrição detalhada da tipografia do título",
        "subtitulo": "Descrição da tipografia do subtítulo",
        "corpo": "Descrição da tipografia do corpo"
      },
      "layout": {
        "formato": "Nome e dimensões do formato",
        "grid": "Descrição detalhada do grid e composição",
        "elementos": [
          { "nome": "Nome do elemento", "posicao": "Posição exata", "tamanho": "Tamanho relativo" }
        ]
      },
      "elementos_visuais": "Descrição de gradientes, sombras, efeitos, overlays",
      "textos": {
        "headline": "Texto principal exato",
        "subtitulo": "Subtítulo exato",
        "cta": "Texto do CTA",
        "legal": "Texto legal se necessário"
      },
      "passo_a_passo": [
        "Passo 1: descrição detalhada",
        "Passo 2: descrição detalhada"
      ],
      "produtos_sugeridos": [
        { "nome": "Nome do produto", "link": "URL completa do produto no site", "motivo": "Por que usar este produto na arte", "posicao_na_arte": "Onde posicionar na composição" }
      ],
      "referencias_estilo": "Descrição do tom visual, inspirações e referências",
      "observacoes": "Notas finais importantes para o designer"
    }
  }
}

Os IDs dos formatos são:
${formats.map((f: any) => `- "${f.id}" = ${f.name} (${f.width}x${f.height}px)`).join("\n")}

REGRAS:

CORES:
- A paleta DEVE conter EXATAMENTE as 3 cores do campo "paletaCores" dos dados do site. NÃO invente cores. NÃO adicione outras.

TIPOGRAFIA:
- As fontes do site estão listadas em "FONTES/TIPOGRAFIA DO SITE". Use os NOMES REAIS dessas fontes.
- No campo "tipografia", para cada nível (titulo, subtitulo, corpo), indique o NOME REAL da fonte (ex: "Montserrat Bold 700", "Open Sans Regular 400", "Roboto Medium 500").
- Se o site usa "Montserrat", escreva "Montserrat" e NÃO "Sans-serif bold" ou "Fonte moderna".
- Se o site usa "Playfair Display", escreva "Playfair Display" e NÃO "Fonte serifada elegante".
- Inclua o peso (Bold, Regular, Medium, Light) e o tamanho sugerido.
- Se nenhuma fonte foi identificada, sugira fontes populares como Montserrat, Open Sans ou Roboto.

LAYOUT E POSICIONAMENTO:
- Cada formato DEVE ter um layout COMPLETAMENTE DIFERENTE e CRIATIVO. NUNCA repita o mesmo layout entre formatos.
- Varie radicalmente: use composições diagonais, assimetria, sobreposição de elementos, layouts em Z, layouts em F, grid partido, elementos sangrados, composição circular, layout em camadas, split screen, layout editorial, mosaico, etc.
- Varie a posição dos elementos: logo nem sempre no topo esquerdo, CTA nem sempre centralizado embaixo. Surpreenda.
- Para cada formato pense: "qual composição visual seria IMPOSSÍVEL de confundir com o formato anterior?"

TEXTOS:
- headline: DEVE ser EXATAMENTE a oferta/promoção que o gestor informou. No máximo UMA palavra antes (ex: se a oferta é "20% OFF", pode ser "GANHE 20% OFF" ou apenas "20% OFF"). NUNCA mude a oferta.
- subtitulo: use um benefício REAL do site, listado no campo "beneficiosDoSite" dos dados extraídos (ex: "Parcele em 3x sem juros", "Frete Grátis", "Troca Grátis"). Se "beneficiosDoSite" estiver vazio, procure nos "headings" e "subheadings". O subtítulo DEVE ser um benefício que o cliente realmente oferece, NUNCA invente.
- cta: texto curto e direto para o botão de ação.
- legal: texto legal se aplicável.

PASSO A PASSO:
- Deve ter pelo menos 8 etapas detalhadas.
- CADA solicitação deve ter um passo a passo ÚNICO e VARIADO. Não siga sempre a mesma sequência.
- Varie a ordem de criação: às vezes comece pelo fundo, às vezes pelo elemento principal, às vezes pela tipografia.
- Sugira técnicas diferentes a cada brief: em um use gradientes, em outro texturas, em outro shapes geométricos, em outro fotomontagem, em outro estilo flat, em outro estilo editorial, em outro minimalista.
- O passo a passo deve refletir o layout único que você propôs — se o layout é diagonal, o passo a passo explica como montar essa diagonal.

PRODUTOS SUGERIDOS:
- O campo "produtosDoSite" contém produtos reais extraídos do site do cliente.

REGRA ABSOLUTA DE PRODUTOS:
- SEMPRE sugira EXATAMENTE 3 produtos. Nem mais, nem menos.
- Cada sugestão é 1 ÚNICO produto individual com seu NOME REAL.
- Os 3 primeiros produtos do site estão listados acima em "OS 3 PRIMEIROS PRODUTOS DO SITE".

Quando o gestor NÃO escreveu sugestão:
- Use EXATAMENTE os 3 produtos listados em "OS 3 PRIMEIROS PRODUTOS DO SITE".
- No campo "nome" coloque o nome EXATO como está listado. Exemplo: se o produto é "Camisa Brasil Away (2) 2026 Jordan Torcedor Masculina", coloque EXATAMENTE "Camisa Brasil Away (2) 2026 Jordan Torcedor Masculina".
- No campo "link" coloque o link EXATO como está listado. COPIE E COLE sem alterar.
- NÃO renomeie, NÃO resuma, NÃO generalize os nomes dos produtos.

Quando o gestor ESCREVEU uma sugestão com tema/categoria/marca/time/entidade:
- A entidade pedida é OBRIGATÓRIA. Siga esta hierarquia:

PASSO 1: Buscar produtos reais no "produtosDoSite" com correspondência direta à entidade.
- Se o gestor pediu "Palmeiras", busque produtos que contenham "Palmeiras" no nome ou link.
- Se encontrar, use o nome REAL e o link REAL. Perfeito.

PASSO 2: Se NÃO encontrar produtos reais, CRIE 3 produtos plausíveis baseados na temática.
- Os nomes devem ser realistas e específicos para a entidade pedida.
- Exemplos para "Palmeiras": "Camisa Palmeiras 2025 Torcedor", "Moletom Palmeiras Verde Oficial", "Short Palmeiras Treino"
- Exemplos para "Nike": "Tênis Nike Air Max 90 Branco", "Camiseta Nike Dri-FIT Preta", "Bermuda Nike Sportswear"
- Exemplos para "vestido preto": "Vestido Midi Preto Canelado", "Vestido Longo Preto Fenda Lateral", "Vestido Curto Preto Básico"
- Os nomes DEVEM conter a entidade pedida. NUNCA substitua por concorrente ou tema diferente.

SOBRE O LINK quando não encontrar produto real:
- Coloque null no campo "link". NÃO invente URLs.
- No campo "motivo", informe: "Produto sugerido com base na temática pedida — designer deve buscar produto similar no site"

É PROIBIDO:
- Retornar produtos de outro time, marca ou tema
- Retornar nomes genéricos como "Produto destaque" ou "Camisa esportiva"
- Deixar de sugerir produtos — SEMPRE retorne 3 sugestões

NOMES DE PRODUTOS:
- NUNCA use nomes genéricos como "Produto genérico", "Camisa básica", "Item 1", "Produto destaque".
- Use SEMPRE o nome REAL e ESPECÍFICO do produto exatamente como aparece em "produtosDoSite".
- Se "produtosDoSite" estiver vazio, use os nomes encontrados em "headings" e "subheadings" para identificar produtos mencionados no site.
- Se mesmo assim não encontrar produtos, informe no campo "nome": o nicho da loja + "Produto não identificado — designer deve buscar no site" e coloque "NAO_ENCONTRADO" no link.
- NUNCA use "Produto 1", "Produto principal", "Item em destaque" ou qualquer nome vago.
- NUNCA invente nomes de produtos que não existem em "produtosDoSite". Use SOMENTE nomes que estão na lista.

LINK DO PRODUTO — REGRA ABSOLUTA:
- Você SÓ pode usar links que existem no campo "link" de "produtosDoSite". COPIE exatamente, sem modificar nenhum caractere.
- É PROIBIDO inventar links. É PROIBIDO montar URLs manualmente. É PROIBIDO assumir que o nome do produto corresponde a um slug de URL.
- Se o gestor pediu um tema (ex: "Flamengo") e você encontrou um produto compatível em "produtosDoSite", use o link EXATO desse produto.
- Se o gestor pediu um tema mas NÃO existe nenhum produto compatível em "produtosDoSite", selecione o produto mais próximo semanticamente que EXISTE na lista e informe no campo "motivo": "Produto mais próximo encontrado — não foi localizado item específico de [tema pedido] no site".
- Se não encontrar NENHUM produto nem remotamente compatível, coloque no campo "link" o valor "NAO_ENCONTRADO" e no campo "motivo" explique: "Não foi encontrado produto de [tema] no site. O designer deve buscar manualmente."
- NUNCA invente um link. NUNCA monte uma URL. Use SOMENTE links copiados de "produtosDoSite".

SUGESTÃO DO GESTOR:
- Se o gestor escreveu uma sugestão/observação, TODO o brief deve se basear nela. A sugestão é a DIRETRIZ PRINCIPAL.
- Se o gestor mencionou um tema, time, marca, categoria ou tipo de produto (ex: "Palmeiras", "jeans", "feminino", "Nike"), TODOS os produtos sugeridos devem ser EXCLUSIVAMENTE desse tema. IGNORE produtos que não correspondem.
- Se o gestor sugeriu um estilo (ex: "minimalista", "agressivo", "elegante"), o conceito visual, layout, tipografia e passo a passo devem seguir esse estilo.
- Se o gestor deu uma ideia de layout (ex: "produto grande no centro", "texto na diagonal"), siga exatamente.
- Se o gestor sugeriu um conceito (ex: "usar modelo feminina", "foco no preço"), o brief inteiro gira em torno disso.
- A sugestão do gestor tem PRIORIDADE ABSOLUTA sobre qualquer outra decisão criativa. Se conflitar com qualquer outra regra, a sugestão do gestor VENCE.

GERAL:
- Cada brief deve ser adaptado ao formato específico (dimensões diferentes = layout diferente)
- O layout deve especificar posição e tamanho de cada elemento
- Seja CRIATIVO e VARIADO. Cada brief deve parecer que foi feito por um diretor criativo diferente.`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [
          { role: "user", content: userPrompt },
        ],
        system: systemPrompt,
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || "";

    // Parse the JSON response
    let briefs: Record<string, unknown>;
    try {
      const parsed = JSON.parse(responseText);
      briefs = parsed.briefs || parsed;
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        briefs = parsed.briefs || parsed;
      } else {
        throw new Error("Failed to parse Claude response as JSON");
      }
    }

    // ─── 4. Save briefs to art_request_formats ───────────

    for (const format of formats) {
      const brief = briefs[format.id];
      if (brief) {
        await supabase
          .from("art_request_formats")
          .update({ ai_brief: brief })
          .eq("request_id", requestId)
          .eq("format_id", format.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, briefs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-brief error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Site Scraping ──────────────────────────────────────────

function isValidHex(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c);
}

function isVibrantColor(hex: string): boolean {
  if (!isValidHex(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  // Must have real color saturation — reject grays, whites, near-whites, blacks
  // Saturation < 0.15 means it's basically gray/white/black
  if (saturation < 0.15) return false;
  return true;
}

function extractBgColors(cssText: string): string[] {
  const colors: string[] = [];
  const bgMatches = cssText.match(/background(?:-color)?:\s*([^;}\n]+)/gi) || [];
  for (const m of bgMatches) {
    const val = m.replace(/background(?:-color)?:\s*/i, "").trim();
    // Extract hex
    const hexes = val.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    colors.push(...hexes.map((h: string) => h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h));
    // Extract rgb/rgba
    const rgbs = val.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g) || [];
    for (const rgb of rgbs) {
      const nums = rgb.match(/\d+/g);
      if (nums && nums.length >= 3) {
        colors.push(`#${parseInt(nums[0]).toString(16).padStart(2, "0")}${parseInt(nums[1]).toString(16).padStart(2, "0")}${parseInt(nums[2]).toString(16).padStart(2, "0")}`);
      }
    }
  }
  return colors;
}

function extractColors(text: string): string[] {
  // Extract hex colors (#XXXXXX and #XXX)
  const hexMatches = text.match(/#[0-9a-fA-F]{6}\b/g) || [];
  // Extract rgb/rgba colors
  const rgbMatches = text.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g) || [];
  const rgbAsHex = rgbMatches.map((rgb: string) => {
    const nums = rgb.match(/\d+/g);
    if (!nums || nums.length < 3) return null;
    const hex = `#${parseInt(nums[0]).toString(16).padStart(2, "0")}${parseInt(nums[1]).toString(16).padStart(2, "0")}${parseInt(nums[2]).toString(16).padStart(2, "0")}`;
    return hex;
  }).filter(Boolean) as string[];

  const all = [...hexMatches, ...rgbAsHex];
  // Filter out common non-brand colors (pure black, white, grays)
  const filtered = all.filter((c: string) => {
    const lower = c.toLowerCase();
    return lower !== "#000000" && lower !== "#ffffff" && lower !== "#f5f5f5" && lower !== "#eeeeee" && lower !== "#cccccc" && lower !== "#333333" && lower !== "#666666" && lower !== "#999999";
  });
  return [...new Set(filtered.length > 0 ? filtered : all)];
}

async function scrapeSite(url: string): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GPM-ArtBot/1.0)",
      },
    });

    if (!response.ok) {
      return { error: `Site returned ${response.status}`, url };
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || "";

    // Extract meta description
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
    const description = metaDescMatch?.[1]?.trim() || "";

    // Extract og:image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/i);
    const ogImage = ogImageMatch?.[1]?.trim() || "";

    const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const allCss = styleBlocks.join(" ");

    // ─── 1. Cor de fundo do tema/site ────────────────────
    let themeBgColor = "";
    const bodyStyle = html.match(/<body[^>]*style=["']([^"']*)["']/i);
    if (bodyStyle) { const bgs = extractBgColors(bodyStyle[1]); if (bgs.length) themeBgColor = bgs[0]; }
    if (!themeBgColor) { const r = allCss.match(/body\s*\{([^}]*)\}/i); if (r) { const bgs = extractBgColors(r[1]); if (bgs.length) themeBgColor = bgs[0]; } }
    if (!themeBgColor) { const r = allCss.match(/html\s*\{([^}]*)\}/i); if (r) { const bgs = extractBgColors(r[1]); if (bgs.length) themeBgColor = bgs[0]; } }
    if (!themeBgColor) themeBgColor = "#ffffff";

    // ─── 2. Cores do rodapé ──────────────────────────────
    const footerBgColors: string[] = [];
    const footerTagStyle = html.match(/<footer[^>]*style=["']([^"']*)["']/i);
    if (footerTagStyle) footerBgColors.push(...extractBgColors(footerTagStyle[1]));
    const footerClassMatch = html.match(/<footer[^>]*class=["']([^"']*)["']/i);
    if (footerClassMatch) {
      for (const cls of footerClassMatch[1].split(/\s+/)) {
        const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rule = allCss.match(new RegExp(`\\.${escaped}[^{]*\\{([^}]*)\\}`, "i"));
        if (rule) footerBgColors.push(...extractBgColors(rule[1]));
      }
    }
    const footerHtmlMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
    if (footerHtmlMatch) {
      const innerBgs = footerHtmlMatch[1].match(/style=["'][^"']*background[^"']*["']/gi) || [];
      for (const s of innerBgs) { const val = s.match(/style=["']([^"']*)["']/i); if (val) footerBgColors.push(...extractBgColors(val[1])); }
      footerBgColors.push(...extractColors(footerHtmlMatch[1]));
    }

    // ─── 3. Cores de DESTAQUE (botões, CTAs, banners) ────
    const accentColors: string[] = [];

    // Buttons — inline styles
    const btnStyles = html.match(/<(?:button|a)[^>]*style=["']([^"']*)["']/gi) || [];
    for (const b of btnStyles) { const val = b.match(/style=["']([^"']*)["']/i); if (val) accentColors.push(...extractBgColors(val[1])); }

    // CSS classes with "btn", "button", "cta", "primary", "accent", "highlight", "banner"
    const accentClassPatterns = /\.(?:[a-z-]*(?:btn|button|cta|primary|accent|highlight|banner|action|promo)[a-z-]*)\s*\{([^}]*)\}/gi;
    let accentMatch;
    while ((accentMatch = accentClassPatterns.exec(allCss)) !== null) {
      accentColors.push(...extractBgColors(accentMatch[1]));
      // Also grab text color from these (often the brand color IS the text/border color)
      const colorMatch = accentMatch[1].match(/(?:^|;|\s)color:\s*([^;}\n]+)/i);
      if (colorMatch) accentColors.push(...extractColors(colorMatch[1]));
      const borderMatch = accentMatch[1].match(/border(?:-color)?:\s*([^;}\n]+)/i);
      if (borderMatch) accentColors.push(...extractColors(borderMatch[1]));
    }

    // Links with bright colors
    const linkRule = allCss.match(/a\s*\{([^}]*)\}/i);
    if (linkRule) {
      const colorMatch = linkRule[1].match(/(?:^|;|\s)color:\s*([^;}\n]+)/i);
      if (colorMatch) accentColors.push(...extractColors(colorMatch[1]));
    }

    // Elements with vibrant inline backgrounds anywhere on page
    const allInlineBgs = html.match(/style=["'][^"']*background(?:-color)?:\s*([^;"']+)/gi) || [];
    for (const s of allInlineBgs) {
      const colors = extractColors(s);
      // Only keep vibrant/non-gray colors
      for (const c of colors) {
        if (isVibrantColor(c)) accentColors.push(c);
      }
    }

    // CSS :root / custom properties (--primary, --accent, --brand, etc.)
    const cssVarPattern = /--(?:primary|accent|brand|highlight|cta|action|main)[^:]*:\s*([^;}\n]+)/gi;
    let varMatch;
    while ((varMatch = cssVarPattern.exec(allCss)) !== null) {
      accentColors.push(...extractColors(varMatch[1]));
      const val = varMatch[1].trim();
      if (val.startsWith("#") || val.startsWith("rgb")) accentColors.push(val);
    }

    // Deduplicate and filter
    const uniqueFooterBgColors = [...new Set(footerBgColors.filter(isValidHex))];
    const uniqueAccentColors = [...new Set(accentColors.filter(isValidHex).filter(isVibrantColor))];

    // Extract headings
    const h1Matches = html.match(/<h1[^>]*>(.*?)<\/h1>/gi) || [];
    const headings = h1Matches
      .map((h: string) => h.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean)
      .slice(0, 5);

    // Extract h2s
    const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
    const subheadings = h2Matches
      .map((h: string) => h.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean)
      .slice(0, 5);

    // Extract font families from CSS
    const fontMatches = html.match(/font-family:\s*([^;}"']+)/gi) || [];
    const rawFonts = fontMatches.map((f: string) => f.replace(/font-family:\s*/i, "").trim());

    // Extract Google Fonts from <link> tags
    const googleFontLinks = html.match(/fonts\.googleapis\.com\/css[^"']*family=([^"'&]+)/gi) || [];
    for (const link of googleFontLinks) {
      const familyMatch = link.match(/family=([^"'&]+)/i);
      if (familyMatch) {
        const families = decodeURIComponent(familyMatch[1]).split("|").map((f: string) => f.split(":")[0].replace(/\+/g, " ").trim());
        rawFonts.push(...families);
      }
    }

    // Extract @font-face declarations
    const fontFaceMatches = allCss.match(/@font-face\s*\{[^}]*font-family:\s*['"]?([^;'"}\n]+)/gi) || [];
    for (const ff of fontFaceMatches) {
      const nameMatch = ff.match(/font-family:\s*['"]?([^;'"}\n]+)/i);
      if (nameMatch) rawFonts.push(nameMatch[1].trim().replace(/['"]/g, ""));
    }

    // Clean and deduplicate fonts, remove generic fallbacks
    const genericFonts = ["sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui", "-apple-system", "BlinkMacSystemFont", "inherit", "initial"];
    const fonts = [...new Set(rawFonts
      .map((f: string) => f.split(",")[0].trim().replace(/['"]/g, ""))
      .filter((f: string) => f.length > 1 && !genericFonts.includes(f.toLowerCase()))
    )].slice(0, 5);

    // Extract logo candidates
    const logoMatches = html.match(/<img[^>]*(?:logo|brand|marca)[^>]*src=["'](.*?)["']/gi) || [];
    const logos = logoMatches
      .map((m: string) => {
        const srcMatch = m.match(/src=["'](.*?)["']/);
        return srcMatch?.[1] || "";
      })
      .filter(Boolean)
      .slice(0, 3);

    // ─── Paleta final: fundo + 2 destaques mais relevantes ─
    const topAccents = uniqueAccentColors.filter((c: string) => c !== themeBgColor).slice(0, 2);
    const paleta = [themeBgColor, ...topAccents];

    // ─── Extrair benefícios do site (frete, parcelamento, etc.)
    const benefitPatterns = /(?:frete\s*gr[áa]tis|parcel[ae]\s*(?:em\s*)?\d+x|sem\s*juros|troca\s*gr[áa]tis|entrega\s*r[áa]pida|compre\s*\d+\s*leve|desconto|cashback|cupom|devolu[çc][ãa]o|garantia|primeira\s*compra|frete\s*fixo|envio\s*gr[áa]tis)/gi;
    const allText = html.replace(/<[^>]*>/g, " ");
    const benefitMatches = allText.match(benefitPatterns) || [];
    // Also look for longer benefit phrases
    const benefitPhrases: string[] = [];
    const phrasePatterns = [
      /(?:parcele?\s*(?:em\s*)?(?:at[ée]\s*)?\d+x\s*(?:sem\s*juros)?)/gi,
      /(?:frete\s*gr[áa]tis[^.!,\n]{0,30})/gi,
      /(?:troca\s*(?:e\s*devolu[çc][ãa]o\s*)?gr[áa]tis[^.!,\n]{0,30})/gi,
      /(?:entrega\s*(?:em\s*)?(?:at[ée]\s*)?\d+[^.!,\n]{0,20})/gi,
      /(?:compre\s*\d+\s*(?:e\s*)?leve\s*\d+)/gi,
      /(?:primeira\s*compra[^.!,\n]{0,30})/gi,
      /(?:garantia\s*(?:de\s*)?\d+[^.!,\n]{0,20})/gi,
    ];
    for (const p of phrasePatterns) {
      const matches = allText.match(p) || [];
      benefitPhrases.push(...matches.map((m: string) => m.trim()));
    }
    const uniqueBenefits = [...new Set([...benefitPhrases, ...benefitMatches])].slice(0, 5);

    // ─── Extrair produtos do site ──────────────────────────
    const produtos: { nome: string; preco: string; link: string }[] = [];

    // Pattern 1: Nuvemshop/Tiendanube — href + item-name (most common BR e-commerce)
    const nuvemshopPairs = html.matchAll(/href="(https?:\/\/[^"]*\/produtos\/[^"]+)"[\s\S]{0,500}?item-name[^>]*>([\s\S]*?)<\//gi);
    for (const match of nuvemshopPairs) {
      const link = match[1].trim();
      const nome = match[2].replace(/<[^>]*>/g, "").trim();
      if (nome && nome.length > 2 && nome.length < 100 && !nome.startsWith("<")) {
        const priceContext = html.substring(Math.max(0, match.index! - 500), match.index! + 500);
        const priceMatch = priceContext.match(/price_short[^"]*"([^"]+)"/);
        produtos.push({ nome, link, preco: priceMatch ? priceMatch[1] : "" });
      }
    }

    // Pattern 2: JSON-LD structured data
    if (produtos.length === 0) {
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const block of jsonLdMatches) {
        try {
          const jsonContent = block.replace(/<\/?script[^>]*>/gi, "").trim();
          const parsed = JSON.parse(jsonContent);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (item["@type"] === "Product" || item["@type"] === "ProductGroup") {
              const nome = item.name || "";
              const preco = item.offers?.price || item.offers?.lowPrice || "";
              const link = item.url || "";
              if (nome) produtos.push({ nome, preco: String(preco), link });
            }
            if (item["@type"] === "ItemList" && item.itemListElement) {
              for (const el of item.itemListElement) {
                if (el.item?.name) {
                  produtos.push({ nome: el.item.name, preco: "", link: el.item.url || "" });
                }
              }
            }
          }
        } catch { /* ignore */ }
      }
    }

    // Pattern 3: Generic product cards — href with /product or /produto + nearby title
    if (produtos.length === 0) {
      const genericPairs = html.matchAll(/href="(https?:\/\/[^"]*\/produt[oa]s?\/[^"]+)"[\s\S]{0,300}?(?:product[_-]?(?:name|title)|card[_-]?title|item[_-]?(?:name|title))[^>]*>([\s\S]*?)<\//gi);
      for (const match of genericPairs) {
        const nome = match[2].replace(/<[^>]*>/g, "").trim();
        if (nome && nome.length > 2) produtos.push({ nome, link: match[1], preco: "" });
      }
    }

    // Pattern 4: Any product URL with nearby text
    if (produtos.length === 0) {
      const anyProductLinks = html.matchAll(/href="(https?:\/\/[^"]*\/produt[oa]s?\/[^"]+)"[^>]*>[\s\S]{0,200}?([A-ZÀ-Ú][^<]{3,60})/gi);
      for (const match of anyProductLinks) {
        const nome = match[2].trim();
        if (nome) produtos.push({ nome, link: match[1], preco: "" });
      }
    }

    // Deduplicate by name
    const seen = new Set<string>();
    const uniqueProdutos = produtos.filter((p) => {
      const key = p.nome.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 25);

    return {
      url,
      title,
      description,
      ogImage,
      paletaCores: paleta,
      beneficiosDoSite: uniqueBenefits,
      produtosDoSite: uniqueProdutos,
      headings,
      subheadings,
      fonts,
      logos,
    };
  } catch (error) {
    return { error: `Failed to scrape: ${error.message}`, url };
  }
}
