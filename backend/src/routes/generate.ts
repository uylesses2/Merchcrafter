import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { generateImagePrompt } from '../services/imagePrompting';

export async function generateRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    app.post('/preview', {
        schema: {
            body: z.object({
                projectId: z.number(),
                prompt: z.string().optional(), // Legacy text prompt
                stylePreset: z.string().optional(), // Legacy style
                // New Fields
                entityId: z.string().optional(),
                format: z.string().default('POSTER_INFOGRAPHIC'),
                styles: z.array(z.string()).default(['DIGITAL_PAINTING']),
                use: z.string().default('POSTER')
            }),
        },
    }, async (request, reply) => {
        const { projectId, prompt, stylePreset, entityId, format, styles, use } = request.body;
        const userId = request.user.id;

        const project = await prisma.project.findFirst({
            where: { id: projectId, userId },
        });

        if (!project) {
            return reply.status(404).send({ message: 'Project not found' });
        }

        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.credits < 1) {
            return reply.status(402).send({ message: 'Insufficient credits' });
        }

        // --- Build JSON Prompt ---
        let promptPayload = "{}";
        let entityName = "Unknown";
        let entityType = "SCENE";
        let analysisResult = {};

        // Fetch Entity & Analysis if ID provided
        if (entityId) {
            // Try fetching from Character/Scene? 
            // For now, check if there's an analysis record (Analysis table uses entityName + entityType).
            // Or try finding a Character record.
            // Simplified: If entityId matches an Analysis ID? 
            // Or if entityId is passed, we assume it's valid and we might look up Name from Analysis?
            const analysis = await prisma.analysis.findFirst({
                where: { OR: [{ id: entityId }, { entityName: entityId }] } // Flexible lookup
            });

            if (analysis) {
                entityName = analysis.entityName;
                entityType = analysis.entityType;
                try {
                    analysisResult = JSON.parse(analysis.resultJson);
                } catch (e) {
                    console.warn("Failed to parse analysis result for prompt generation");
                }
            }
        }

        // Fallback or override with legacy prompt
        const focusText = prompt || undefined;

        try {
            promptPayload = generateImagePrompt({
                entityId: entityId,
                entityName,
                entityType,
                analysisResult,
                creativeSelection: {
                    format: format,
                    styles: styles.length > 0 ? styles : (stylePreset ? [stylePreset] : []),
                    notes: focusText
                },
                provenance: {
                    projectId: projectId,
                    bookId: undefined // Could infer from project
                }
            });
        } catch (e: any) {
            return reply.status(400).send({ message: `Prompt generation failed: ${e.message}` });
        }

        // TODO: Call Gemini 3 Pro with promptPayload (JSON string)

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { credits: { decrement: 1 } },
            });
            await tx.creditTransaction.create({
                data: {
                    userId,
                    amount: -1,
                    type: 'PREVIEW',
                },
            });
            await tx.generation.create({
                data: {
                    projectId,
                    type: 'PREVIEW',
                    status: 'COMPLETED',
                    imageUrl: 'https://placehold.co/400', // Stub image
                    prompt: prompt || 'JSON Prompt Generated',
                    promptPayload: promptPayload, // Store strict JSON
                    stylePreset: stylePreset || styles[0],
                },
            });
        });

        return { success: true, imageUrl: 'https://placehold.co/400' };
    });

    app.post('/final', {
        schema: {
            body: z.object({
                previewId: z.number(),
            })
        }
    }, async (request, reply) => {
        // Stub implementation 
        const userId = request.user.id;
        const { credits } = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (credits < 2) {
            return reply.status(402).send({ message: 'Insufficient credits' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { credits: { decrement: 2 } },
            });
            await tx.creditTransaction.create({
                data: {
                    userId,
                    amount: -2,
                    type: 'FINAL',
                },
            });
            // Update generation status or create new final record
        });

        return { success: true, imageUrl: 'https://placehold.co/2400' };
    });
}
