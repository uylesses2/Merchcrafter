import { prisma } from './db';
import { vectorStore } from './vectorStore';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { GEMINI_GENERATION_MODEL } from "../config/geminiModel";

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: GEMINI_GENERATION_MODEL });

export async function aggregateBookData(bookId: string, userId: number) {
    console.log(`[AGGREGATION] Starting aggregation for book ${bookId}...`);

    // 1. Fetch Micro-Fragments
    const snippets = await vectorStore.getAllBookSnippets(bookId, userId);
    console.log(`[AGGREGATION] Fetched ${snippets.length} snippets.`);

    if (snippets.length === 0) return;

    // 2. Identify Characters (Batch processing or sampling usually, but let's try a summary approach)
    // For large books, we can't context fit everything. 
    // Strategy: Filter snippets that have entity_names, group by name, and pick top frequent ones.

    const entityCounts: Record<string, number> = {};
    const entitySnippets: Record<string, string[]> = {};

    snippets.forEach(s => {
        s.entity_names?.forEach(name => {
            entityCounts[name] = (entityCounts[name] || 0) + 1;
            if (!entitySnippets[name]) entitySnippets[name] = [];
            if (entitySnippets[name].length < 20) entitySnippets[name].push(s.text); // Keep a sample
        });
    });

    const topEntities = Object.entries(entityCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 30) // Top 30 mentioned entities
        .map(([name]) => name);

    console.log(`[AGGREGATION] Top entities: ${topEntities.join(', ')}`);

    // 3. Generate Character Profiles
    for (const name of topEntities) {
        const sampleTexts = entitySnippets[name].join('\n');
        const prompt = `
        Analyze the following texts about "${name}".
        Determine if this is a Character. If so, provide:
        - Role (Protagonist, etc.)
        - Array of Traits (Type: PHYSICAL_APPEARANCE, PERSONALITY, etc., Description)
        
        Input:
        ${sampleTexts}

        Output JSON:
        {
            "isCharacter": boolean,
            "role": string,
            "traits": [ { "type": string, "description": string } ]
        }
        `;

        try {
            const res = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            });
            const data = JSON.parse(res.response.text());

            if (data.isCharacter) {
                const char = await prisma.character.create({
                    data: {
                        bookId,
                        name: name,
                        role: data.role,
                    }
                });

                if (data.traits) {
                    for (const t of data.traits) {
                        await prisma.characterTrait.create({
                            data: {
                                characterId: char.id,
                                traitType: t.type,
                                description: t.description,
                                sourcesSummary: "Derived from aggregation"
                            }
                        });
                    }
                }
                console.log(`[AGGREGATION] Created character: ${name}`);
            }
        } catch (e) {
            console.error(`[AGGREGATION] Failed to analyze entity ${name}`, e);
        }
    }

    // 4. Identify Scenes (Clustering by position)
    // Simple heuristic: Gaps in positionIndex > X or purely sequential chunking
    // For now, let's just create "Scenes" based on approximate chapters if we had them, OR just every 50 snippets.
    // Making dummy scenes for demo based on 50-snippet blocks.

    let sceneSnippets: string[] = [];
    let startIdx = 0;

    for (let i = 0; i < snippets.length; i++) {
        sceneSnippets.push(snippets[i].text);

        // Every 50 snippets approx 1 scene
        if (sceneSnippets.length >= 50 || i === snippets.length - 1) {
            const sceneText = sceneSnippets.join('\n');
            const scenePrompt = `
            Summarize the following text block as a "Scene".
            Provide a title and a short summary.
            Identify key entities present.

            Output JSON:
            { "title": string, "summary": string, "entities": string[] }
            `;

            try {
                const res = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: scenePrompt }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                });
                const data = JSON.parse(res.response.text());

                const scene = await prisma.scene.create({
                    data: {
                        bookId,
                        title: data.title,
                        summary: data.summary,
                        startPosition: startIdx,
                        endPosition: i
                    }
                });

                if (data.entities) {
                    for (const ent of data.entities) {
                        // Try to link to existing char
                        const existingChar = await prisma.character.findFirst({
                            where: { bookId, name: ent }
                        });

                        await prisma.sceneEntity.create({
                            data: {
                                sceneId: scene.id,
                                entityName: ent,
                                characterId: existingChar?.id,
                                entityType: existingChar ? 'CHARACTER' : 'OTHER'
                            }
                        });
                    }
                }
                console.log(`[AGGREGATION] Created scene: ${data.title}`);

            } catch (e) {
                console.error(`[AGGREGATION] Scene generation failed`, e);
            }

            sceneSnippets = [];
            startIdx = i + 1;
        }
    }

    console.log(`[AGGREGATION] Completed for book ${bookId}`);
}
