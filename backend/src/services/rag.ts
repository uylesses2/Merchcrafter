import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from './db';

let genAI: GoogleGenerativeAI | null = null;

export async function generateEmbedding(text: string, retries: number = 3): Promise<number[]> {
    try {
        const { llmConfig } = await import('./llmConfig');
        const configData = await llmConfig.getTaskConfig('embeddings');
        const { apiKey, modelName } = configData;

        // Mock Mode Check (check settings from provider config, or global env fallback if really needed, but let's stick to simple key check or config)
        // If apiKey is "mock" or similar? Or check process.env.MOCK_MODE for safety?
        // User request says "admin-controlled".
        // Let's assume if key is missing or invalid, llmConfig throws.

        if (!genAI) {
            genAI = new GoogleGenerativeAI(apiKey);
        }
        // Always get model from config, don't rely on cached genAI with old key if key changed? 
        // Actually genAI instance uses one key. If key changes, we need new instance.
        // For now, re-instantiate if key differs? Or just new instance every time (cheap).
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({ model: modelName });

        // 2. Execution
        const result = await model.embedContent(text);
        const embedding = result.embedding.values;

        // 3. Privacy-aware Logging
        // console.log(`[EMBEDDING] Using model: ${modelName} | vector length: ${embedding.length}`);

        // Track Usage (Embeddings usually don't return usage in this SDK version, or maybe they do?)
        // Let's use estimate for now.
        const inputTokens = estimateTokens(text);
        await llmConfig.trackUsage('embeddings', inputTokens, 0);

        return embedding;

    } catch (err: any) {
        // 4. Retry Logic for Network Errors (fetch failed)
        if (retries > 0) {
            // console.warn(`[EMBEDDING] Failed (Retries left: ${retries}). Error: ${err.message}. Retrying in 1s...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return generateEmbedding(text, retries - 1);
        }

        // 5. Fallback/Error
        console.error(`[EMBEDDING FAILED] Error: ${err.message}`);

        // Mock fallback if env says so?
        if (process.env.MOCK_MODE === 'true') {
            console.warn("[EMBEDDING] Fallback to mock vector.");
            return new Array(768).fill(0).map(() => Math.random());
        }

        throw err;
    }
}

// Helper to estimate tokens (rough char count / 4)
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}


export async function findSimilarChunks(queryEmbedding: number[], bookId: string, limit: number = 20) {
    // Retrieve all chunks for the book
    // In a production vector DB, this would be a vector similarity query.
    // For SQLite + Node, we'll implement cosine similarity in-memory for this scale.

    const chunks = await (prisma as any).bookChunk.findMany({
        where: { bookId },
        select: { id: true, text: true, embedding: true, startPage: true, endPage: true, chunkIndex: true }
    });

    // 1. Calculate Scores
    const scored = chunks.map((chunk: any) => {
        const embedding = JSON.parse(chunk.embedding) as number[];
        const score = cosineSimilarity(queryEmbedding, embedding);
        return { ...chunk, score };
    });

    // 2. Sort by Score & Take Top K
    scored.sort((a: any, b: any) => b.score - a.score);
    const topK = scored.slice(0, limit);

    // 3. Re-sort Top K by content order (Chunk Index) for coherent reading w/ threshold check
    // Filter basically irrelevant chunks if score < 0.4 (arbitrary threshold for this embedding model)
    // text-embedding-004 is varying, but let's keep it simple for now or just take Top K.
    // For "Holistic" analysis, reading in order is crucial.

    // Sort by chunkIndex
    topK.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);

    return topK;
}


function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return isNaN(similarity) ? 0 : similarity;
}

export async function findCharacterPassages(bookId: string, entityLabel: string): Promise<any[]> {
    console.log(`[CHAR PIPELINE] Starting keyword search for: ${entityLabel}`);

    // 1. Generate Aliases
    const aliases = generateAliases(entityLabel);
    console.log(`[CHAR PIPELINE] Aliases: ${aliases.join(', ')}`);

    // 2. Fetch ALL chunks that contain any alias (Prisma OR query)
    // Note: SQLite 'contains' is case-insensitive usually, but let's be safe.
    // Construct OR condition
    const searchConditions = aliases.map(alias => ({
        text: { contains: alias }
    }));

    const chunks = await (prisma as any).bookChunk.findMany({
        where: {
            bookId,
            OR: searchConditions
        },
        select: { id: true, text: true, chunkIndex: true },
        orderBy: { chunkIndex: 'asc' }
    });

    console.log(`[CHAR PIPELINE] Found ${chunks.length} raw chunks containing name.`);

    if (chunks.length === 0) return [];

    // 3. Sentence Extraction & Filtering
    // Heuristic Keywords for physical appearance
    const PHYSICAL_KEYWORDS = [
        'hair', 'eyes', 'face', 'skin', 'tall', 'short', 'build', 'muscular', 'slender',
        'scar', 'beard', 'mouth', 'nose', 'wearing', 'clad', 'dressed', 'cloak', 'coat',
        'boots', 'shirt', 'dress', 'gown', 'armor', 'helmet', 'sword', 'staff', 'look',
        'appearence', 'beautiful', 'ugly', 'handsome', 'plain', 'fat', 'thin', 'stout',
        'gaze', 'glance', 'feature', 'complexion', 'shoulder', 'hand', 'finger'
    ];

    // Also include common colors to catch "blue silk", "red wool", etc.
    const COLOR_KEYWORDS = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'grey', 'gray', 'silver', 'gold', 'brown', 'purple', 'crimson', 'scarlet', 'azure'];
    const ALL_KEYWORDS = [...PHYSICAL_KEYWORDS, ...COLOR_KEYWORDS];

    const relevantSentences: any[] = [];
    const seenSentences = new Set<string>();

    for (const chunk of chunks) {
        // Split chunk into sentences (simplistic regex)
        const sentences = chunk.text.match(/[^.!?]+[.!?]+/g) || [chunk.text];

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            const lowerSentence = sentence.toLowerCase();

            // Must contain an alias AND a physical keyword
            const hasAlias = aliases.some(a => lowerSentence.includes(a.toLowerCase()));

            // If the sentence itself has the alias, OR the immediate context (prev/next) has the alias (to catch pronoun refs nearby)
            // For V1, let's keep it tight: Sentence must have one of our physical keywords.
            // AND we take context around it.

            // Check keywords
            const hasKeyword = ALL_KEYWORDS.some(k => lowerSentence.includes(k));

            if (hasAlias && hasKeyword) {
                // Good candidate. Take context window (-1, +1)
                const prev = i > 0 ? sentences[i - 1].trim() : "";
                const next = i < sentences.length - 1 ? sentences[i + 1].trim() : "";

                const contextBlock = [prev, sentence, next].filter(s => s).join(" ");

                if (!seenSentences.has(contextBlock)) {
                    seenSentences.add(contextBlock);
                    relevantSentences.push({
                        text: contextBlock,
                        chunkIndex: chunk.chunkIndex,
                        source: `Chunk ${chunk.chunkIndex} (Keyword Match)`
                    });
                }
            }
        }
    }

    console.log(`[CHAR PIPELINE] Extracted ${relevantSentences.length} physical description snippets.`);

    // Cap at ~30 snippets to avoid token limits
    return relevantSentences.slice(0, 30);
}

function generateAliases(name: string): string[] {
    const parts = name.split(' ').map(s => s.trim()).filter(s => s);
    const aliases = new Set<string>();

    aliases.add(name); // Full
    if (parts.length > 1) {
        aliases.add(parts[0]); // First
        aliases.add(parts[parts.length - 1]); // Last
    }

    // Lowercase handled by DB query usually, but normalized punctuation might help
    // e.g. "al'Thor" -> "alThor" ? Maybe not necessary for LIKE.

    return Array.from(aliases);
}

