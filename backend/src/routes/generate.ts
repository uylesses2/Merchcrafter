import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export async function generateRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    app.post('/preview', {
        schema: {
            body: z.object({
                projectId: z.number(),
                stylePreset: z.string(),
                // other fields...
            }),
        },
    }, async (request, reply) => {
        const { projectId, stylePreset } = request.body;
        const userId = request.user.id;

        const project = await prisma.project.findFirst({
            where: { id: projectId, userId },
        });

        if (!project) {
            return reply.status(404).send({ message: 'Project not found' });
        }

        const { credits } = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (credits < 1) {
            return reply.status(402).send({ message: 'Insufficient credits' });
        }

        // TODO: Call Gemini 3 Pro here for preview

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
        // Stub implementation similar to preview but upscale
        // Deduct 2 credits
        const userId = request.user.id;
        const { credits } = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (credits < 2) {
            return reply.status(402).send({ message: 'Insufficient credits' });
        }

        // TODO: Call Upscaler logic

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
            // Create final generation record...
        });

        return { success: true, imageUrl: 'https://placehold.co/2400' };
    });
}
