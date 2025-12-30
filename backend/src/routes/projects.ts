import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export async function projectRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    app.post('/', {
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

    app.get('/', async (request) => {
        const userId = request.user.id;
        const projects = await prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return projects;
    });

    app.get('/:id', {
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

        return project;
    });
    app.delete('/:id', {
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

        await prisma.project.delete({
            where: { id },
        });

        return { success: true };
    });
}
