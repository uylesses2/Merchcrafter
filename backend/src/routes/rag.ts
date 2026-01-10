
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { generateEmbedding } from '../services/rag';
import { vectorStore } from '../services/vectorStore';
import { config, MODEL_REASONING } from '../config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const EntityTypeEnum = z.enum([
    'CHARACTER',
    'MONSTER_OR_CREATURE',
    'ITEM_OR_ARTIFACT',
    'LOCATION',
    'SCENE_OR_EVENT',
    'GROUP_OR_FACTION_OR_ORGANIZATION',
    'LANDMARK_OR_STRUCTURE',
    'BATTLE_OR_DUEL_OR_CONFLICT',
    'SPELL_OR_POWER_OR_ABILITY',
    'VEHICLE_OR_MOUNT',
    'PROPHECY_OR_LEGEND_OR_MYTH',
    'ALIEN',
    'ENTITY',
    'PLANET',
    'STAR_SYSTEM',
    'SPACE_SHIP',
    'SPACE_STATION',
    'SPACE_ANOMALY'
]);

const AnalysisModeEnum = z.enum([
    'GENERAL_PROFILE',
    'KEY_SCENES',
    'RELATIONSHIPS',
    'QUOTES',
    'VISUAL_ART',
    'VISUAL_DESCRIPTION'
]);

let genAI: GoogleGenerativeAI | null = null;

export async function ragRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    // Unified Analysis Endpoint
    app.post('/query', {
        schema: {
            body: z.object({
                userId: z.number().optional(),
                bookId: z.string().optional(), // Legacy support
                bookIds: z.array(z.string()).optional(), // New Multi-book support
                entityType: EntityTypeEnum,
                entityLabel: z.string(),
                analysisMode: AnalysisModeEnum.optional().default('VISUAL_ART'),
                focus: z.string().optional(),
                save: z.boolean().default(false),
                projectId: z.number().optional(),
                summary: z.string().optional(),
                tags: z.array(z.string()).optional()
            })
        }
    }, async (request, reply) => {
        const {
            bookId,
            bookIds: inputBookIds,
            entityType,
            entityLabel,
            analysisMode,
            focus,
            save,
            projectId,
            summary: inputSummary,
            tags
        } = request.body as any; // Cast to any to suppress lints if provider inference fails, or ideally define type.

        const userId = request.user.id;

        // Resolve Book IDs
        let targetBookIds: string[] = [];
        if (inputBookIds && inputBookIds.length > 0) {
            targetBookIds = inputBookIds;
        } else if (bookId) {
            targetBookIds = [bookId];
        } else {
            return reply.status(400).send({ message: 'Must provide bookId or bookIds' });
        }

        // Validate Access to Books
        const books = await (prisma as any).book.findMany({
            where: {
                id: { in: targetBookIds },
                userId
            },
            select: { id: true, title: true }
        });

        if (books.length === 0) {
            return reply.status(404).send({ message: 'No accessible books found for provided IDs.' });
        }

        try {
            // New Visual Analysis Path
            if (analysisMode === 'VISUAL_ART' || analysisMode === 'VISUAL_DESCRIPTION') {
                const { analyzeVisualDescription } = await import('../services/visualAnalyzer');
                const result = await analyzeVisualDescription(userId, targetBookIds, entityLabel, entityType, focus);

                // Save Logic (Reused)
                let savedAnalysis: any = null;
                if (save) {
                    savedAnalysis = await (prisma as any).analysis.create({
                        data: {
                            userId,
                            projectId,
                            entityType,
                            entityName: entityLabel,
                            mode: analysisMode,
                            rawQuery: `Visual Analysis of ${entityLabel}`,
                            resultJson: JSON.stringify(result),
                            summary: result.description || 'Visual Analysis',
                            tags: JSON.stringify(tags || []),
                            books: {
                                create: targetBookIds.map(bid => ({ bookId: bid }))
                            }
                        }
                    });
                }

                // Log Query
                await (prisma as any).ragQueryLog.create({
                    data: {
                        userId,
                        bookId: targetBookIds[0],
                        entityType,
                        entityLabel,
                        analysisMode
                    }
                });

                return {
                    result,
                    analysisId: savedAnalysis ? savedAnalysis.id : undefined,
                    savedAnalysis
                };
            }

            // Existing RAG Path for other modes
            // 1. Build Query & Embed
            const bookTitles = books.map((b: any) => b.title).join(', ');
            const queryText = `${entityType}: ${entityLabel}. Mode: ${analysisMode}. Focus: ${focus || 'General'}. Books: ${bookTitles}. Find relevant details.`;
            const queryEmbedding = await generateEmbedding(queryText);

            console.log(`[RAG] Query embedding created successfully (Mode: ${analysisMode})`);

            // 2. Retrieve Context (Qdrant)
            let relevantChunks: any[] = [];

            // Loop search for each book (can be optimized later)
            const promises = targetBookIds.map(bid => vectorStore.searchFragments({
                userId,
                bookId: bid,
                embedding: queryEmbedding,
                sourceType: 'BOOK',
                topK: Math.max(10, Math.floor(50 / targetBookIds.length)) // Distribute topK
            }));

            try {
                const results = await Promise.all(promises);
                relevantChunks = results.flat().sort((a, b) => b.score - a.score).slice(0, 50);
            } catch (searchErr: any) {
                console.error(`[RAG ERROR] Vector store search failed: ${searchErr.message}`);
                return reply.status(503).send({
                    message: 'Retrieval subsystem unavailable.',
                    error: searchErr.message
                });
            }

            const contextText = relevantChunks.map((c: any) => {
                const loc = c.page_number ? `Page ${c.page_number}` : `Fragment`;
                const bTitle = books.find((b: any) => b.id === c.book_id)?.title || 'Unknown Book';
                return `[${bTitle} - ${loc}]: ${c.text}`;
            }).join('\n\n---\n\n');


            // 3. Prompt Engineering
            let systemInstruction = `
            You are a expert literary analyst and script consultant.
            Analyze the provided text fragments from "${bookTitles}" and extract detailed information.
            Target Entity: "${entityLabel}" (Type: ${entityType})
            Mode: ${analysisMode}
            Focus: ${focus || 'General'}

            Rules:
            - Ground your analysis ONLY in the provided text fragments. 
            - If details are missing, state that they are not specified.
            - Provide citations (e.g. [Book Title - Page X]) where possible.
            `;

            let jsonStructure = "";

            switch (analysisMode) {
                // VISUAL modes moved to service
                case 'RELATIONSHIPS':
                    systemInstruction += ` Mode: RELATIONSHIPS. Analyze interactions.`;
                    jsonStructure = `
                     "title": "Relationships",
                     "description": "Overview.",
                     "connections": [ { "entityName": "...", "relationType": "...", "details": "..." } ],
                     "contextSources": []
                     `;
                    break;
                case 'KEY_SCENES':
                    systemInstruction += ` Mode: KEY SCENES. Identify major events.`;
                    jsonStructure = `
                     "title": "Key Scenes",
                     "description": "Progression.",
                     "scenes": [ { "sceneTitle": "...", "description": "...", "significance": "..." } ],
                     "contextSources": []
                     `;
                    break;
                case 'QUOTES':
                    systemInstruction += ` Mode: QUOTES. Extract voice and dialogue.`;
                    jsonStructure = `
                     "title": "Quotes & Voice",
                     "description": "Voice analysis.",
                     "quotes": [ { "text": "...", "context": "..." } ],
                     "contextSources": []
                     `;
                    break;
                case 'GENERAL_PROFILE':
                default:
                    systemInstruction += ` Mode: GENERAL PROFILE. Backstory and role.`;
                    jsonStructure = `
                     "title": "General Profile",
                     "description": "Summary.",
                     "roleInStory": "...",
                     "characterArc": "...",
                     "background": "...",
                     "contextSources": []
                     `;
                    break;
            }

            const prompt = `
            CONTEXT:
            ${contextText}

            INSTRUCTIONS:
            Produce pure JSON matching:
            {
                ${jsonStructure}
            }
            `;

            if (relevantChunks.length === 0) {
                return reply.send({
                    message: "No relevant info found.",
                    result: { description: "No data found." }
                });
            }

            if (!genAI) genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);
            const model = genAI.getGenerativeModel({
                model: MODEL_REASONING,
                systemInstruction
            });

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // Clean JSON
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            let parsedResult;
            try {
                parsedResult = JSON.parse(cleanJson);
            } catch (e) {
                console.error("JSON Parsing failed", responseText);
                return reply.status(500).send({ message: "AI response malformed", raw: responseText });
            }

            // 4. Save if requested
            let savedAnalysis: any = null;
            if (save) {
                savedAnalysis = await (prisma as any).analysis.create({
                    data: {
                        userId,
                        projectId,
                        entityType,
                        entityName: entityLabel,
                        mode: analysisMode,
                        rawQuery: queryText,
                        resultJson: cleanJson,
                        summary: parsedResult.description || inputSummary || 'Analysis Result',
                        tags: JSON.stringify(tags || []),
                        books: {
                            create: targetBookIds.map(bid => ({ bookId: bid }))
                        }
                    }
                });
            }

            // Log Query
            await (prisma as any).ragQueryLog.create({
                data: {
                    userId,
                    bookId: targetBookIds[0], // Log primary book
                    entityType,
                    entityLabel,
                    analysisMode
                }
            });

            return {
                result: parsedResult,
                analysisId: savedAnalysis ? savedAnalysis.id : undefined,
                savedAnalysis
            };

        } catch (err: any) {
            console.error(err);
            return reply.status(500).send({ message: 'Internal Server Error', error: err.message });
        }
    });

    // History Endpoint
    app.get('/history', async (req, reply) => {
        const history = await (prisma as any).ragQueryLog.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { book: { select: { title: true } } }
        });
        return history;
    });
    // List Analyses Endpoint
    app.get('/analyses', async (req, reply) => {
        const analyses = await (prisma as any).analysis.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                entityName: true,
                entityType: true,
                mode: true,
                summary: true,
                resultJson: true,
                createdAt: true
            }
        });
        return analyses;
    });
}
