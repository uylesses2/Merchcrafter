import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { extractTextFromPdf, chunkText } from '../services/pdf';
import { generateEmbedding } from '../services/rag';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { vectorStore, BookFragment } from '../services/vectorStore';
import crypto from 'crypto';
import { aggregateBookData } from '../services/aggregation';


const pump = util.promisify(pipeline);

export async function bookRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    app.get('/', async (request, reply) => {
        const userId = request.user.id;
        const books = await (prisma as any).book.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        return books;
    });

    app.post('/upload', async (req, reply) => {
        const parts = req.parts();
        let title = '';
        let ownershipConfirmed = false;
        let originalFilename = '';
        let savedPath = '';

        // Temporary tracking
        let fileProcessed = false;

        const userId = req.user.id;
        const uploadDir = path.join(process.cwd(), 'uploads');

        for await (const part of parts) {
            console.log(`[UPLOAD] Processing part: ${part.fieldname} (${part.type})`);
            if (part.type === 'field') {
                if (part.fieldname === 'title') title = part.value as string;
                if (part.fieldname === 'ownershipConfirmed') ownershipConfirmed = part.value === 'true';
                console.log(`[UPLOAD] Field ${part.fieldname} = ${part.value}`);
            } else if (part.type === 'file') {
                if (part.fieldname === 'file' && part.mimetype === 'application/pdf') {
                    originalFilename = part.filename;
                    const filename = `${Date.now()}-${part.filename}`;
                    savedPath = path.join(uploadDir, filename);
                    console.log(`[UPLOAD] Streaming file to ${savedPath}...`);
                    try {
                        await pump(part.file, fs.createWriteStream(savedPath));
                        console.log(`[UPLOAD] File stream complete: ${savedPath}`);
                        fileProcessed = true;
                    } catch (streamErr) {
                        console.error(`[UPLOAD ERROR] Stream failed for ${savedPath}:`, streamErr);
                        throw streamErr;
                    }
                } else {
                    console.log(`[UPLOAD] Skipping non-pdf file or wrong fieldname: ${part.mimetype}`);
                    part.file.resume(); // Discard other files
                }
            }
        }

        console.log(`[UPLOAD] Finished processing parts. ownershipConfirmed: ${ownershipConfirmed}, fileProcessed: ${fileProcessed}`);

        if (!ownershipConfirmed) {
            console.warn(`[UPLOAD] Rejected: Ownership not confirmed`);
            return reply.status(400).send({ message: 'Ownership confirmation required' });
        }
        if (!fileProcessed) {
            console.warn(`[UPLOAD] Rejected: No PDF file found in request`);
            return reply.status(400).send({ message: 'No PDF file uploaded' });
        }

        // Create Book Record
        const book = await prisma.book.create({
            data: {
                userId,
                title: title || originalFilename,
                originalFilename,
                storagePath: savedPath,
                status: 'PENDING'
            }
        });

        // Trigger Ingestion Background (Synchronous for now for simplicity)
        (async () => {
            try {
                // =========================================================
                // INGESTION: Timeline-Aware Service
                // =========================================================
                const { ingestBook } = await import('../services/ingestBook');
                const result = await ingestBook(book.id);

                if (result.success) {
                    console.log(`[INGESTION] Successfully completed processing for ${book.title}. Stats:`, result.stats);
                    // Status update is handled inside ingestBook
                } else {
                    console.error("[INGESTION FAILED]", result.error);
                    // Status update is handled inside ingestBook
                }

            } catch (err: any) {
                console.error("[INGESTION FAILED (Route Wrapper)]", err);
                await (prisma as any).book.update({
                    where: { id: book.id },
                    data: { status: 'FAILED' }
                });
            }
        })();


        return { message: 'Upload started', book };
    });

    // Delete Book
    app.delete('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const userId = req.user.id;

        // 1. Find Book
        const book = await (prisma as any).book.findFirst({
            where: { id, userId }
        });

        if (!book) {
            return reply.status(404).send({ message: 'Book not found' });
        }

        console.log(`[DELETE] Starting deletion for book: ${id} (${book.title})`);

        try {
            // 2. Cleanup External Stores (File & Vectors)
            if (fs.existsSync(book.storagePath)) {
                fs.unlinkSync(book.storagePath);
                console.log(`[DELETE] Removed file: ${book.storagePath}`);
            } else {
                console.warn(`[DELETE] File not found at: ${book.storagePath}`);
            }

            // Clean Qdrant
            await vectorStore.deleteBookFragments(id);

            // 3. Cascade Delete in DB (Manual due to lack of Prisma Cascade)
            // Order matters for foreign keys

            // Level 4: Deepest dependencies
            await (prisma as any).characterTrait.deleteMany({ where: { character: { bookId: id } } });
            await (prisma as any).sceneEntity.deleteMany({ where: { scene: { bookId: id } } });

            // Level 3: Scenes & Ingestion
            await (prisma as any).bookChunk.deleteMany({ where: { bookId: id } }); // Chunks reference scenes
            await (prisma as any).scene.deleteMany({ where: { bookId: id } });

            // Level 2: Chapters & Characters & Joins
            await (prisma as any).chapter.deleteMany({ where: { bookId: id } });
            await (prisma as any).character.deleteMany({ where: { bookId: id } });
            await (prisma as any).ingestionJob.deleteMany({ where: { bookId: id } });

            // Joins
            await (prisma as any).projectBook.deleteMany({ where: { bookId: id } });
            await (prisma as any).analysisBook.deleteMany({ where: { bookId: id } });
            await (prisma as any).ragQueryLog.deleteMany({ where: { bookId: id } });

            // Level 1: Book
            await (prisma as any).book.delete({
                where: { id }
            });

            console.log(`[DELETE] Successfully deleted book ${id}`);
            return { message: 'Book deleted successfully' };

        } catch (err: any) {
            console.error(`[DELETE ERROR] Failed to delete book ${id}`, err);
            return reply.status(500).send({ message: `Failed to delete book: ${err.message}` });
        }
    });

    // Trigger Aggregation (Manual Layer C Population)
    app.post('/:id/aggregate', async (req, reply) => {
        const { id } = req.params as { id: string };
        const userId = req.user.id;

        const book = await (prisma as any).book.findFirst({ where: { id, userId } });
        if (!book) return reply.status(404).send({ message: 'Book not found' });

        // Trigger in background
        aggregateBookData(id, userId).catch(err => console.error(`[AGGREGATION ERROR]`, err));

        return { message: 'Aggregation started in background' };
    });
}

