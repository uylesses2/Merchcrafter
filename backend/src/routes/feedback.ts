import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export async function feedbackRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    // User Submit
    app.post('/', {
        schema: {
            body: z.object({
                category: z.enum(['ENTITY_TYPE', 'ART_STYLE', 'MERCH_TYPE', 'GENERAL']),
                title: z.string(),
                message: z.string()
            })
        }
    }, async (req, reply) => {
        const { category, title, message } = req.body;
        const feedback = await prisma.userFeedback.create({
            data: {
                userId: req.user.id,
                category,
                title,
                message,
                status: 'NEW'
            }
        });
        return feedback;
    });

    // User History
    app.get('/', async (req, reply) => {
        return prisma.userFeedback.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
    });

    // Admin Routes
    app.get('/admin', async (req, reply) => {
        if (req.user.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });

        return prisma.userFeedback.findMany({
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { email: true } } }
        });
    });

    app.patch('/admin/:id', {
        schema: {
            body: z.object({
                status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED']),
                adminNote: z.string().optional()
            })
        }
    }, async (req, reply) => {
        if (req.user.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
        const { id } = req.params as { id: string };
        const { status, adminNote } = req.body;

        const updated = await prisma.userFeedback.update({
            where: { id },
            data: { status, adminNote }
        });
        return updated;
    });
}
