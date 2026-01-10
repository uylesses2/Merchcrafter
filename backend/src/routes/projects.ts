import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

import { ZodTypeProvider } from 'fastify-type-provider-zod';

export async function projectRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    app.addHook('onRequest', app.authenticate);

    router.post('/', {
        schema: {
            body: z.object({
                name: z.string(),
                description: z.string().optional(),
            }),
        },
    }, async (request, reply) => {
        const { name, description } = request.body;
        const userId = request.user.id;

        const project = await prisma.project.create({
            data: {
                userId,
                originalFilename: name, // Using this field as "Project Name" to minimize migration friction
                description: description || '',
                status: "CREATED",
            }
        });

        return { project };
    });

    router.get('/', async (request) => {
        const userId = request.user.id;
        const projects = await prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { books: true, analyses: true, generations: true }
                }
            }
        });
        return projects;
    });

    router.get('/:id', {
        schema: {
            params: z.object({
                id: z.coerce.number(),
            }),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const userId = request.user.id;

        const project = await prisma.project.findFirst({
            where: { id, userId },
            include: {
                books: {
                    include: { book: true }
                },
                analyses: {
                    orderBy: { createdAt: 'desc' }
                },
                generations: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!project) {
            return reply.status(404).send({ message: 'Project not found' });
        }

        // Flatten books
        const flatBooks = project.books.map(pb => pb.book);
        const bookIds = flatBooks.map(b => b.id);

        // Fetch related analyses (linked to project OR linked to any of the project's books)
        const analyses = await prisma.analysis.findMany({
            where: {
                OR: [
                    { projectId: project.id },
                    { books: { some: { bookId: { in: bookIds } } } }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

        // Merge into project object
        return {
            ...project,
            books: flatBooks,
            analyses: analyses // Overwrites the included empty analyses if any
        };
    });
    // Link Books to Project
    router.post('/:id/books', {
        schema: {
            params: z.object({ id: z.coerce.number() }),
            body: z.object({ bookIds: z.array(z.string()) })
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const { bookIds } = request.body;
        const userId = request.user.id;

        const project = await prisma.project.findFirst({ where: { id, userId } });
        if (!project) return reply.status(404).send({ message: 'Project not found' });

        // Upsert links (ignore duplicates)
        // SQLite doesn't support createMany nicely for ignoring duplicates easily in Prisma without workarounds, 
        // so we iterate or use Promise.all.
        await Promise.all(bookIds.map(bid =>
            (prisma as any).projectBook.upsert({
                where: { projectId_bookId: { projectId: id, bookId: bid } },
                create: { projectId: id, bookId: bid },
                update: {}
            })
        ));

        return { success: true };
    });

    router.delete('/:id/books/:bookId', {
        schema: {
            params: z.object({ id: z.coerce.number(), bookId: z.string() })
        }
    }, async (request, reply) => {
        const { id, bookId } = request.params;
        const userId = request.user.id;
        const project = await prisma.project.findFirst({ where: { id, userId } });
        if (!project) return reply.status(404).send({ message: 'Project not found' });

        await (prisma as any).projectBook.deleteMany({
            where: { projectId: id, bookId }
        });
        return { success: true };
    });

    router.delete('/:id', {
        schema: {
            params: z.object({
                id: z.coerce.number(),
            }),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const userId = request.user.id;

        const project = await prisma.project.findFirst({
            where: { id, userId },
        });

        if (!project) {
            return reply.status(404).send({ message: 'Project not found' });
        }

        // Cleanup generations manually to be safe
        await prisma.generation.deleteMany({
            where: { projectId: id }
        });

        await prisma.project.delete({
            where: { id },
        });

        return { success: true };
    });

    // Image Generation
    router.post('/:id/generations', {
        schema: {
            params: z.object({ id: z.coerce.number() }),
            body: z.object({
                entityId: z.string().optional(),
                entityIds: z.array(z.string()).optional(), // For composition
                artStyle: z.string(),
                merchStyle: z.string().optional(),
                imageFormat: z.string().optional(), // New field
                outputUse: z.string().optional(),   // New field
                presetId: z.string().optional(),    // New field
                mode: z.enum(['SINGLE', 'SCENE', 'MOODBOARD']).default('SINGLE')
            })
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const { entityId, entityIds, artStyle, merchStyle, mode, imageFormat, outputUse, presetId } = request.body;
        const userId = request.user.id;

        const project = await prisma.project.findFirst({ where: { id, userId } });
        if (!project) return reply.status(404).send({ message: 'Project not found' });

        // 1. Resolve Provider (Default to OpenAI for Images for now, or fetch from config)
        // Ideally: llmConfig.getTaskConfig('imageGeneration')
        const { llmConfig } = await import('../services/llmConfig');
        const config = await llmConfig.getTaskConfig('imageGeneration');


        const { getProviderClient } = await import('../services/providers/factory');
        const client = getProviderClient(config.providerName);

        // 2. Build Prompt
        // 2. Build Prompt (Strict JSON)
        const { generateImagePrompt, mapLegacyToNew } = await import('../services/imagePrompting');
        let prompt = "";
        let primaryEntityId = entityId;

        if (mode === 'SINGLE' && entityId) {
            // Fetch analysis for traits
            const analysis = await prisma.analysis.findFirst({
                where: { id: entityId, userId } // Check ownership, not project linkage strictness
            });

            // Fallback: If passed ID is actually a Character ID (from structured table)
            // We need a unified way to get traits. For now assume it points to Analysis.

            if (!analysis) {
                // Try looking up Character table?
                // For MVP, if we don't find it, we just use a placeholder name? No, failure.
                // Let's assume the frontend passes the right ID. 
                // If the frontend lists "Analysis" items, we use those.
                // If it lists "Character" items, we use those.
                // We'll trust the input for now is an Analysis ID.
                return reply.status(404).send({ message: "Entity analysis not found" });
            }

            // Extract data for JSON prompt
            let analysisResult = {};
            try {
                if (analysis.resultJson) {
                    analysisResult = JSON.parse(analysis.resultJson);
                } else if (analysis.summary) {
                    // Legacy fallback
                    analysisResult = { attributes: { description: analysis.summary } };
                }
            } catch (e) {
                console.warn("Failed to parse analysis JSON, using summary fallback");
                analysisResult = { attributes: { description: analysis.summary || "No details" } };
            }

            const creativeSelection = {
                format: imageFormat || merchStyle || 'Standard',
                style: artStyle,
                use: outputUse || 'POSTER',
                presetId,
                constraints: {} // If constraints came from body, pass here
            };

            prompt = generateImagePrompt({
                entityName: analysis.entityName,
                entityType: analysis.entityType,
                analysisResult,
                creativeSelection,
                source: { bookId: undefined, bookTitle: undefined }, // Could fetch book info if needed
                focusText: undefined // Or pass if UI allows
            });

        } else if ((mode === 'SCENE' || mode === 'MOODBOARD') && entityIds && entityIds.length > 0) {
            const analyses = await prisma.analysis.findMany({
                where: { id: { in: entityIds }, userId } // Check ownership
            });

            const entities = analyses.map(a => ({ name: a.entityName, traits: a.summary || "" }));

            if (mode === 'SCENE') {
                // Construct a composite "Scene" analysis result
                const compositeAttributes = entities.reduce((acc: any, e, i) => {
                    acc[`entity_${i + 1}_${e.name}`] = e.traits;
                    return acc;
                }, { description: `A scene featuring ${entities.map(e => e.name).join(', ')}` });

                prompt = generateImagePrompt({
                    entityName: "Scene Composition",
                    entityType: "SCENE",
                    analysisResult: { attributes: compositeAttributes },
                    creativeSelection: {
                        format: imageFormat || merchStyle || 'Standard',
                        style: artStyle,
                        use: outputUse || 'POSTER',
                        presetId
                    }
                });

            } else {
                // MOODBOARD
                const compositeAttributes = entities.reduce((acc: any, e, i) => {
                    acc[`element_${i + 1}_${e.name}`] = e.traits;
                    return acc;
                }, { description: `Mood board elements for ${entities.map(e => e.name).join(', ')}` });

                prompt = generateImagePrompt({
                    entityName: "Mood Board",
                    entityType: "MOODBOARD",
                    analysisResult: { attributes: compositeAttributes },
                    creativeSelection: {
                        format: 'Mood Board',
                        style: artStyle,
                        use: outputUse || 'INFOGRAPHIC_PANEL',
                        presetId
                    }
                });
            }
            primaryEntityId = undefined; // Composite
        } else {
            return reply.status(400).send({ message: "Invalid generation parameters" });
        }

        // 3. Generate
        console.log(`[IMAGE GEN] Prompt: ${prompt}`);

        // Mock check?
        // if (process.env.MOCK_IMAGE_GEN === 'true') ...

        try {
            const imageUrls = await client.generateImage(prompt, config.apiKey, {
                modelName: config.modelName,
                quality: 'standard',
                style: 'vivid'
            });

            // 4. Save Record
            const generation = await prisma.generation.create({
                data: {
                    projectId: id,
                    type: "FINAL", // Treating all as final for now or 'PREVIEW'
                    entityId: primaryEntityId,
                    prompt: prompt,
                    artStyle,
                    merchStyle,
                    imageUrl: imageUrls[0], // DALL-E 3 or Gemini gives 1 by default
                    status: "COMPLETED",
                    provider: config.providerName,
                    model: config.modelName
                } as any // Bypass outdated types
            });

            return { generation };

        } catch (err: any) {
            console.error("Image Gen Error", err);
            // Return the specific error message to the client for debugging
            return reply.status(500).send({ message: `Generation failed: ${err.message || err}` });
        }
    });

    router.delete('/:id/generations/:genId', {
        schema: {
            params: z.object({
                id: z.coerce.number(),
                genId: z.coerce.number()
            })
        }
    }, async (request, reply) => {
        const { id, genId } = request.params;
        const userId = request.user.id;

        const project = await prisma.project.findFirst({
            where: { id, userId }
        });

        if (!project) return reply.status(404).send({ message: 'Project not found' });

        const generation = await prisma.generation.findFirst({
            where: { id: genId, projectId: id }
        });

        if (!generation) return reply.status(404).send({ message: 'Generation not found' });

        await prisma.generation.delete({
            where: { id: genId }
        });

        return { success: true };
    });

}
