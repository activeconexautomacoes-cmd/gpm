export type SuggestedProduct = {
  name: string;
  url: string | null;
  description: string;
  source: "real_site" | "inferred";
  matchType: "exact" | "related" | "inferred";
  position: string;
};

function isValidProduct(p: any): boolean {
  if (!p || typeof p !== "object") return false;
  const name = typeof p.nome === "string" ? p.nome : typeof p.name === "string" ? p.name : "";
  return name.trim().length > 2
    && !name.toLowerCase().includes("produto genérico")
    && !name.toLowerCase().includes("produto não identificado")
    && !name.toLowerCase().includes("não encontrei")
    && !name.toLowerCase().includes("designer deve buscar")
    && !name.toLowerCase().includes("produto destaque da coleção")
    && !name.toLowerCase().includes("produto secundário da coleção")
    && !name.toLowerCase().includes("produto complementar da coleção");
}

function isValidUrl(url: any): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  return u.startsWith("http") && u !== "nao_encontrado" && u !== "null" && u.length > 10;
}

function inferProducts(theme?: string, siteUrl?: string): SuggestedProduct[] {
  const t = (theme || "").toLowerCase();

  const teams: Record<string, SuggestedProduct[]> = {
    flamengo: [
      { name: "Camisa Flamengo Torcedor 2025", url: siteUrl || null, description: "Produto principal com temática do Flamengo para destaque visual", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita, com destaque visual e sombra" },
      { name: "Moletom Flamengo Rubro-Negro", url: siteUrl || null, description: "Produto secundário para composição em camadas", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro, criando composição em camadas" },
      { name: "Copo Térmico Flamengo Oficial", url: siteUrl || null, description: "Item complementar para reforço temático", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita, complementando a composição visual" },
    ],
    palmeiras: [
      { name: "Camisa Palmeiras Torcedor 2025", url: siteUrl || null, description: "Produto principal com temática do Palmeiras para destaque visual", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita, com destaque visual e sombra" },
      { name: "Jaqueta Palmeiras Verde Oficial", url: siteUrl || null, description: "Produto secundário para composição em camadas", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro, criando composição em camadas" },
      { name: "Caneca Palmeiras Oficial", url: siteUrl || null, description: "Item complementar para reforço temático", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita, complementando a composição visual" },
    ],
    corinthians: [
      { name: "Camisa Corinthians I 2025 Torcedor", url: siteUrl || null, description: "Produto principal com temática do Corinthians", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita, com destaque visual e sombra" },
      { name: "Moletom Corinthians Preto Oficial", url: siteUrl || null, description: "Produto secundário para composição", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro, criando composição em camadas" },
      { name: "Boné Corinthians Aba Reta", url: siteUrl || null, description: "Item complementar para reforço temático", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita, complementando a composição visual" },
    ],
    "são paulo": [
      { name: "Camisa São Paulo FC 2025 Torcedor", url: siteUrl || null, description: "Produto principal com temática do São Paulo", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita, com destaque visual e sombra" },
      { name: "Jaqueta São Paulo Tricolor Oficial", url: siteUrl || null, description: "Produto secundário para composição", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro, criando composição em camadas" },
      { name: "Mochila São Paulo FC Oficial", url: siteUrl || null, description: "Item complementar para reforço temático", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita, complementando a composição visual" },
    ],
    nike: [
      { name: "Tênis Nike Air Max 90 Branco", url: siteUrl || null, description: "Produto principal Nike para destaque visual", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita, com destaque visual e sombra" },
      { name: "Camiseta Nike Dri-FIT Preta", url: siteUrl || null, description: "Produto secundário Nike para composição", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro, criando composição em camadas" },
      { name: "Bermuda Nike Sportswear", url: siteUrl || null, description: "Item complementar Nike", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita, complementando a composição visual" },
    ],
    adidas: [
      { name: "Tênis Adidas Ultraboost 23", url: siteUrl || null, description: "Produto principal Adidas para destaque visual", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita, com destaque visual e sombra" },
      { name: "Camiseta Adidas Essentials 3-Stripes", url: siteUrl || null, description: "Produto secundário Adidas para composição", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro, criando composição em camadas" },
      { name: "Calça Adidas Tiro Training", url: siteUrl || null, description: "Item complementar Adidas", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita, complementando a composição visual" },
    ],
  };

  // Check known teams/brands
  for (const [key, products] of Object.entries(teams)) {
    if (t.includes(key)) return products;
  }

  // Generic theme inference based on keywords
  if (t.includes("jeans") || t.includes("denim")) {
    return [
      { name: `Calça Jeans Skinny ${theme}`, url: siteUrl || null, description: "Peça principal jeans para destaque", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita" },
      { name: `Short Jeans Destroyed ${theme}`, url: siteUrl || null, description: "Peça secundária jeans para composição", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro" },
      { name: `Jaqueta Jeans Oversized ${theme}`, url: siteUrl || null, description: "Peça complementar jeans", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita" },
    ];
  }

  if (t.includes("vestido")) {
    return [
      { name: `Vestido Midi ${theme} Elegante`, url: siteUrl || null, description: "Peça principal para destaque", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita" },
      { name: `Vestido Curto ${theme} Casual`, url: siteUrl || null, description: "Peça secundária para composição", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro" },
      { name: `Vestido Longo ${theme} Festa`, url: siteUrl || null, description: "Peça complementar", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita" },
    ];
  }

  if (t.includes("fitness") || t.includes("academia") || t.includes("treino")) {
    return [
      { name: "Legging Cintura Alta Supplex", url: siteUrl || null, description: "Peça fitness principal para destaque", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita" },
      { name: "Top Nadador com Bojo Removível", url: siteUrl || null, description: "Peça fitness secundária", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro" },
      { name: "Conjunto Seamless Treino", url: siteUrl || null, description: "Peça fitness complementar", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita" },
    ];
  }

  // If theme provided but no specific match, use theme in names
  if (theme && theme.trim()) {
    return [
      { name: `${theme} — Produto Principal`, url: siteUrl || null, description: `Produto principal com temática de ${theme}`, source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita, com destaque visual e sombra" },
      { name: `${theme} — Produto Secundário`, url: siteUrl || null, description: `Produto secundário com temática de ${theme}`, source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro, criando composição em camadas" },
      { name: `${theme} — Produto Complementar`, url: siteUrl || null, description: `Produto complementar com temática de ${theme}`, source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita, complementando a composição visual" },
    ];
  }

  // No theme at all - should not happen because real products should be used
  return [
    { name: "Produto em destaque da loja", url: siteUrl || null, description: "Produto selecionado com base no contexto visual", source: "inferred", matchType: "inferred", position: "Elemento central na área superior direita" },
    { name: "Segundo produto em destaque", url: siteUrl || null, description: "Produto de apoio para composição visual", source: "inferred", matchType: "inferred", position: "Elemento secundário sobreposto parcialmente ao primeiro" },
    { name: "Terceiro produto em destaque", url: siteUrl || null, description: "Produto complementar para equilíbrio visual", source: "inferred", matchType: "inferred", position: "Elemento menor na lateral direita" },
  ];
}

const POSITIONS = [
  "Elemento central na área superior direita, com destaque visual e sombra",
  "Elemento secundário sobreposto parcialmente ao primeiro, criando composição em camadas",
  "Elemento menor na lateral direita, complementando a composição visual",
];

export function normalizeSuggestedProducts(
  rawProducts: any[],
  theme?: string,
  siteUrl?: string
): SuggestedProduct[] {
  const validProducts = Array.isArray(rawProducts)
    ? rawProducts.filter(isValidProduct).map((p, index) => ({
        name: String(p.nome || p.name || "").trim(),
        url: isValidUrl(p.link || p.url) ? String(p.link || p.url).trim() : (siteUrl || null),
        description: String(p.motivo || p.description || "Produto real identificado no site").trim(),
        source: "real_site" as const,
        matchType: "exact" as const,
        position: String(p.posicao_na_arte || p.position || POSITIONS[index] || POSITIONS[0]).trim(),
      }))
    : [];

  if (validProducts.length >= 3) {
    return validProducts.slice(0, 3);
  }

  if (validProducts.length > 0) {
    const inferred = inferProducts(theme, siteUrl);
    const missing = 3 - validProducts.length;
    return [...validProducts, ...inferred.slice(0, missing)];
  }

  return inferProducts(theme, siteUrl);
}
