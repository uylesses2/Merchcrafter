import { prisma } from './src/services/db';
import { generateEmbedding, findSimilarChunks } from './src/services/rag';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const BOOK_ID = '3f3211ee-a8d8-45b1-b22c-dfa1cd48524f'; // From user screenshot/logs
const QUERY = 'Rand al thor';

async function debugRag() {
    console.log(`[DEBUG] Target Book: ${BOOK_ID}`);
    console.log(`[DEBUG] Query: ${QUERY}`);

    // 1. Generate Embedding
    console.log(`[DEBUG] Generating embedding for query...`);
    const embedding = await generateEmbedding(QUERY);
    console.log(`[DEBUG] Embedding generated. Length: ${embedding.length}`);
    console.log(`[DEBUG] First 5 values: ${embedding.slice(0, 5).join(', ')}`);

    // 2. Retrieve Chunks
    console.log(`[DEBUG] Finding similar chunks...`);
    const chunks = await findSimilarChunks(embedding, BOOK_ID, 3);
    console.log(`[DEBUG] Found ${chunks.length} chunks.`);

    if (chunks.length === 0) {
        console.error("❌ No chunks found! Is the Book ID correct?");
        return;
    }

    chunks.forEach((c: any, i: number) => {
        console.log(`\n--- Chunk ${i + 1} (Score: ${c.score.toFixed(4)}) ---`);
        console.log(c.text.substring(0, 200) + "...");
    });

    // 3. Generate (Mimic rag.ts)
    console.log(`\n[DEBUG] generating content with Gemini...`);
    const contextText = chunks.map((c: any) => `[Chunk ${c.id}]: ${c.text}`).join('\n\n');

    const prompt = `
    You are an expert visual descriptive assistant.
    Entity Type: CHARACTER
    Entity Label: ${QUERY}
    Focus: General visual description

    Context Snippets:
    ${contextText}

    Please generating a detailed, structured response suitable for an artist or image prompting.
    Format constraints:
    - Output strictly valid JSON.
    - Fields: name, description, physicalAppearance, context.
    `;

    // Use a model available in 2026
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });




    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log("\n[DEBUG] Gemini Response Raw:");
        console.log(text);
    } catch (err: any) {
        console.error("❌ Gemini Generation Failed:", err.message);
    }
}

debugRag()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
