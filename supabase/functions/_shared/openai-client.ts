/**
 * Gemini embedding client for knowledge base
 * Uses gemini-embedding-exp-03-07 (1024 dimensions configured)
 * Falls back to text-embedding-004 if not available
 */

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface EmbeddingResult {
  embedding: number[];
  tokens_used: number;
}

function getApiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedSingle(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini Embedding API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.embedding?.values || [];
}

export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult> {
  const results = await generateBatchEmbeddings([text]);
  return results[0];
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  const apiKey = getApiKey();
  const allResults: EmbeddingResult[] = [];

  for (const text of texts) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const embedding = await embedSingle(text, apiKey);
        allResults.push({ embedding, tokens_used: 0 });
        lastError = null;
        break;
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  return allResults;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
