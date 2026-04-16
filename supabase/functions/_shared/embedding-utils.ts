/**
 * Embedding utilities for knowledge base processing
 * Chunking, hashing, frontmatter extraction, token estimation
 */

// ── Types ───────────────────────────────────────────────────

export interface ChunkResult {
  content: string;
  chunk_index: number;
  chunk_type: "content" | "summary" | "frontmatter";
  token_count: number;
  char_start: number;
  char_end: number;
}

export interface FrontmatterResult {
  title: string;
  metadata: Record<string, unknown>;
  content: string;
}

// ── Constants ───────────────────────────────────────────────

const SMALL_DOC_THRESHOLD = 6000;
const MEDIUM_DOC_THRESHOLD = 30000;
const SLIDING_WINDOW_TOKENS = 1500;
const SLIDING_WINDOW_OVERLAP = 200;
const CHARS_PER_TOKEN_PTBR = 4;

// ── Token estimation ────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_PTBR);
}

// ── SHA-256 hash ────────────────────────────────────────────

export async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Frontmatter extraction ──────────────────────────────────

export function extractFrontmatter(rawContent: string): FrontmatterResult {
  const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = rawContent.match(fmRegex);

  if (!match) {
    const title = extractTitleFromContent(rawContent);
    return { title, metadata: {}, content: rawContent };
  }

  const fmBlock = match[1];
  const content = rawContent.slice(match[0].length);
  const metadata: Record<string, unknown> = {};

  for (const line of fmBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (key && val) {
      metadata[key] = val.replace(/^["']|["']$/g, "");
    }
  }

  const title =
    (metadata.title as string) || extractTitleFromContent(content);

  return { title, metadata, content };
}

function extractTitleFromContent(content: string): string {
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const firstLine = content.trim().split("\n")[0];
  return firstLine?.slice(0, 100) || "Sem título";
}

// ── Category extraction (GPM categories) ────────────────────

const GPM_CATEGORIES = [
  "operacional",
  "marketing",
  "comercial",
  "financeira",
];

export function extractCategoryFromPath(filePath: string): {
  category: string;
  subcategory: string | null;
} {
  const lower = filePath.toLowerCase();
  for (const cat of GPM_CATEGORIES) {
    if (lower.includes(cat)) {
      return { category: cat, subcategory: null };
    }
  }
  return { category: "operacional", subcategory: null };
}

// ── Adaptive chunking ───────────────────────────────────────

export function chunkContent(
  content: string,
  sizeBytes: number
): ChunkResult[] {
  if (sizeBytes <= SMALL_DOC_THRESHOLD) {
    return chunkAtomic(content);
  }
  if (sizeBytes <= MEDIUM_DOC_THRESHOLD) {
    return chunkByHeaders(content);
  }
  return chunkSlidingWindow(content);
}

function chunkAtomic(content: string): ChunkResult[] {
  return [
    {
      content: content.trim(),
      chunk_index: 0,
      chunk_type: "content",
      token_count: estimateTokens(content),
      char_start: 0,
      char_end: content.length,
    },
  ];
}

function chunkByHeaders(content: string): ChunkResult[] {
  const sections = content.split(/(?=^#{1,3}\s)/m);
  const chunks: ChunkResult[] = [];
  let charOffset = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) {
      charOffset += sections[i].length;
      continue;
    }
    chunks.push({
      content: section,
      chunk_index: chunks.length,
      chunk_type: "content",
      token_count: estimateTokens(section),
      char_start: charOffset,
      char_end: charOffset + sections[i].length,
    });
    charOffset += sections[i].length;
  }

  return chunks.length > 0 ? chunks : chunkAtomic(content);
}

function chunkSlidingWindow(content: string): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const windowChars = SLIDING_WINDOW_TOKENS * CHARS_PER_TOKEN_PTBR;
  const overlapChars = SLIDING_WINDOW_OVERLAP * CHARS_PER_TOKEN_PTBR;
  const step = windowChars - overlapChars;

  let pos = 0;
  while (pos < content.length) {
    const end = Math.min(pos + windowChars, content.length);
    let sliceEnd = end;

    if (end < content.length) {
      const nextParagraph = content.indexOf("\n\n", end - 200);
      if (nextParagraph !== -1 && nextParagraph < end + 200) {
        sliceEnd = nextParagraph;
      }
    }

    const chunk = content.slice(pos, sliceEnd).trim();
    if (chunk) {
      chunks.push({
        content: chunk,
        chunk_index: chunks.length,
        chunk_type: "content",
        token_count: estimateTokens(chunk),
        char_start: pos,
        char_end: sliceEnd,
      });
    }

    pos += step;
    if (sliceEnd >= content.length) break;
  }

  return chunks.length > 0 ? chunks : chunkAtomic(content);
}
