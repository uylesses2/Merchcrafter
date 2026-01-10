

import { PrismaClient } from '@prisma/client';
import { llmConfig } from './llmConfig';
import { modelUsage } from './modelUsage';
import { splitIntoMicroFragments, labelMicroFragments } from './microFragments';
import { getProviderClient } from './providers/factory';
import { vectorStore, BookFragment } from './vectorStore';
import { Book } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient(); // Or shared

const BATCH_SIZE = 500;

export const ingestionQueue = {
    async enqueueJob(bookId: string) {
        return await prisma.ingestionJob.create({
            data: {
                bookId,
                status: 'queued'
            }
        });
    },

    /**
     * Main worker loop. Should be called periodically or triggered.
     * In a real app, this might be a separate process or use BullMQ.
     * For MVP, we'll use a simple recursive loop or interval.
     */
    async processQueue() {
        // Find oldest queued job
        const job = await prisma.ingestionJob.findFirst({
            where: { status: 'queued' },
            orderBy: { createdAt: 'asc' },
            include: { book: true } // Assuming relation exists or we fetch book separately
        });

        if (!job) return; // Empty queue

        try {
            // Get Configs
            const labelConfig = await llmConfig.getTaskConfig('microFragmentLabeling');
            const embedConfig = await llmConfig.getTaskConfig('embeddings');

            // Check Book
            const book = await prisma.book.findUnique({ where: { id: job.bookId } });
            if (!book) {
                await prisma.ingestionJob.update({ where: { id: job.id }, data: { status: 'failed', error: 'Book not found' } });
                return;
            }

            // Estimate Cost (Budget Check)
            const todayUsage = await modelUsage.getTodayUsage(labelConfig.providerName, labelConfig.modelName);
            // We define a budget limit somewhere? "configurable per provider+model".
            const DAILY_LIMIT = 5000; // Increased limit for batching

            if (todayUsage.requests >= DAILY_LIMIT) {
                console.log(`[Queue] Budget exceeded for ${labelConfig.modelName}. Job ${job.id} waiting.`);
                return;
            }

            // Start Processing
            await prisma.ingestionJob.update({ where: { id: job.id }, data: { status: 'processing' } });

            // 1. Fetch chunks
            const chunks = await prisma.bookChunk.findMany({ where: { bookId: book.id } });

            // 2. Split (in memory for now, or stream)
            let allUnknownFragments: { text: string; positionIndex: number }[] = [];
            let globalIndex = 0;

            for (const chunk of chunks) {
                const micros = splitIntoMicroFragments(chunk.text);
                micros.forEach(m => {
                    m.positionIndex = globalIndex++;
                    allUnknownFragments.push(m);
                });
            }

            console.log(`[Queue] Book ${book.id} split into ${allUnknownFragments.length} micro-fragments. Starting batch processing...`);

            // 3. Batched Processing (Labeling + Embedding)
            for (let i = 0; i < allUnknownFragments.length; i += BATCH_SIZE) {
                const batch = allUnknownFragments.slice(i, i + BATCH_SIZE);

                const approxTokens = batch.reduce((acc, f) => acc + f.text.length, 0); // approx char count
                console.log(`[Batch] Processing ${batch.length} items. Approx tokens: ${approxTokens}`);

                // 3a. Labeling (Batched)
                // increment usage (approx)
                await modelUsage.incrementUsage(labelConfig.providerName, labelConfig.modelName, { requests: 1, inputTokens: approxTokens / 4 });

                const labeled = await labelMicroFragments(batch);

                // 3b. Embedding (Batched)
                // Get Client
                const embedClient = getProviderClient(embedConfig.providerName);

                // Embed
                const textsToEmbed = labeled.map(f => f.text); // Should match batch text
                const embeddings = await embedClient.embedTexts(textsToEmbed, embedConfig.apiKey, { modelName: embedConfig.modelName });

                // 3c. Upsert to Qdrant
                if (embeddings.length !== labeled.length) {
                    console.error("[Queue] Embedding count mismatch! Skipping upsert for this batch.");
                    continue;
                }

                const fragmentsToUpsert: BookFragment[] = labeled.map((f, idx) => ({
                    id: crypto.randomUUID(),
                    text: f.text,
                    embedding: embeddings[idx],
                    book_id: book.id,
                    user_id: book.userId,
                    source_type: 'BOOK',
                    layer: 'SNIPPET', // Micro-fragment
                    entity_names: f.entityNames,
                    labels: f.labels,
                    position_index: f.positionIndex
                }));

                await vectorStore.upsertFragments(fragmentsToUpsert);
            }

            await prisma.ingestionJob.update({ where: { id: job.id }, data: { status: 'done', message: 'Processed successfully' } });

        } catch (error: any) {
            console.error(`[Queue] Job ${job.id} failed:`, error);
            await prisma.ingestionJob.update({ where: { id: job.id }, data: { status: 'failed', error: error.message } });
        }
    },

    startWorker() {
        setInterval(() => {
            this.processQueue().catch(e => console.error("Worker Error", e));
        }, 10000); // Check every 10s
    }
};

// Start worker immediately on import (singleton style for MVP)
ingestionQueue.startWorker();
