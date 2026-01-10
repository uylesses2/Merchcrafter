
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

export async function analysesRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    app.addHook('onRequest', app.authenticate);

    // List Analyses (Scoped to User)
    router.get('/', {
        schema: {
            querystring: z.object({
                projectId: z.coerce.number().optional(),
                bookId: z.string().optional(),
                entityType: z.string().optional(),
                search: z.string().optional(),
                limit: z.coerce.number().default(50),
            })
        }
    }, async (request) => {
        const { projectId, bookId, entityType, search, limit } = request.query;
        const userId = request.user.id;

        const whereClause: any = { userId };

        if (projectId) whereClause.projectId = projectId;
        if (entityType) whereClause.entityType = entityType;
        if (search) {
            whereClause.OR = [
                { entityName: { contains: search } }, // SQLite contains is roughly case-insensitive depending on collation, but typically we rely on LIKE logic if db was proper
                { summary: { contains: search } }
            ];
        }
        if (bookId) {
            whereClause.books = {
                some: {
                    bookId: bookId
                }
            };
        }

        const analyses = await prisma.analysis.findMany({
            where: whereClause,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                books: {
                    include: {
                        book: { select: { id: true, title: true } }
                    }
                },
                project: { select: { id: true, originalFilename: true } } // Project Name
            }
        });

        // Flatten the book relation for easier frontend consumption
        return analyses.map(a => ({
            ...a,
            books: a.books.map(ab => ab.book)
        }));
    });

    // Get Single Analysis
    router.get('/:id', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const userId = request.user.id;

        const analysis = await prisma.analysis.findFirst({
            where: { id, userId },
            include: {
                books: { include: { book: { select: { id: true, title: true } } } },
                project: { select: { id: true, originalFilename: true } }
            }
        });

        if (!analysis) return reply.status(404).send({ message: 'Analysis not found' });

        return {
            ...analysis,
            books: analysis.books.map(ab => ab.book)
        };
    });

    // Create Analysis (Manual or from RAG result)
    router.post('/', {
        schema: {
            body: z.object({
                projectId: z.number().optional(),
                bookIds: z.array(z.string()),
                entityType: z.string(),
                entityName: z.string(),
                mode: z.string(),
                rawQuery: z.string().optional(),
                resultJson: z.any(), // Accepts object or string, we stringify it
                summary: z.string().optional(),
                tags: z.array(z.string()).default([])
            })
        }
    }, async (request) => {
        const body = request.body;
        const userId = request.user.id;

        // Ensure user owns the books (basic check)
        // Optimization: Could just let the connect fail or trust ID if valid UUID. 
        // For robustness, lets verify at least one existence or rely on FK constraints.

        const analysis = await prisma.analysis.create({
            data: {
                userId,
                projectId: body.projectId,
                entityType: body.entityType,
                entityName: body.entityName,
                mode: body.mode,
                rawQuery: body.rawQuery,
                resultJson: typeof body.resultJson === 'string' ? body.resultJson : JSON.stringify(body.resultJson),
                summary: body.summary,
                tags: JSON.stringify(body.tags),
                books: {
                    create: body.bookIds.map(bid => ({ bookId: bid }))
                }
            }
        });

        return analysis;
    });

    // Update Analysis
    router.put('/:id', {
        schema: {
            params: z.object({ id: z.string() }),
            body: z.object({
                projectId: z.number().optional().nullable(),
                summary: z.string().optional(),
                tags: z.array(z.string()).optional()
            })
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const userId = request.user.id;

        // Verify ownership
        const existing = await prisma.analysis.findFirst({ where: { id, userId } });
        if (!existing) return reply.status(404).send({ message: 'Analysis not found' });

        const data: any = {};
        if (body.projectId !== undefined) data.projectId = body.projectId;
        if (body.summary !== undefined) data.summary = body.summary;
        if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);

        const updated = await prisma.analysis.update({
            where: { id },
            data
        });

        return updated;
    });

    // Delete Analysis
    router.delete('/:id', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const userId = request.user.id;

        const existing = await prisma.analysis.findFirst({ where: { id, userId } });
        if (!existing) return reply.status(404).send({ message: 'Analysis not found' });

        // Cascade delete join table
        await prisma.analysisBook.deleteMany({ where: { analysisId: id } });

        await prisma.analysis.delete({ where: { id } });

        return { success: true };
    });
}
