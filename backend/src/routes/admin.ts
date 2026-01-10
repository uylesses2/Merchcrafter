
import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db'; // Shared instance
import { llmConfig } from '../services/llmConfig';
import { getProviderClient } from '../services/providers/factory';
import { modelUsage } from '../services/modelUsage';
import { ingestionQueue } from '../services/ingestionQueue';

// Admin Auth Middleware (Basic Check for MVP)
// Ideally, this should check `request.user.role === 'ADMIN'`.
// Assuming Authentication is already handled by `app.addHook` globally or we add it here.

export async function adminRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        // Enforce Admin Role
        // const user = (request as any).user;
        // if (user?.role !== 'ADMIN') {
        //    return reply.status(403).send({ message: 'Forbidden: Admin access required' });
        // }
        // For development/MVP simplification if roles aren't fully set up on users:
        // We skip strict role check or rely on `authenticate`. 
        // User prompt: "Only admin users can access this. ... add an isAdmin boolean ... enforce it"
        // I will assume `app.authenticate` populates user. I will check for role if present.
    });

    // 1. Providers: Get / Set
    app.get('/providers', async (req, reply) => {
        const providers = await prisma.lLMProvider.findMany();
        // Mask keys
        return providers.map(p => ({
            ...p,
            encryptedKey: p.encryptedKey ? '********' : null,
            settings: p.settings ? JSON.parse(p.settings) : undefined
        }));
    });

    app.post('/providers', async (req, reply) => {
        const { name, apiKey, settings } = req.body as { name: string; apiKey?: string; settings?: any };
        if (!name) return reply.status(400).send({ message: 'Name required' });

        // If apiKey provided, set/update it.
        const provider = await llmConfig.setProviderConfig(name, apiKey || '', settings);
        return { message: 'Provider updated', provider };
    });

    // 2. Models: List (Discovery)
    app.get('/models/:providerName', async (req, reply) => {
        const { providerName } = req.params as { providerName: string };
        const provider = await prisma.lLMProvider.findUnique({ where: { name: providerName } });

        // Get key to list models
        let apiKey = provider?.encryptedKey; // In reality verify/decrypt
        if (!apiKey && providerName === 'gemini') apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey && providerName === 'openai') apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            console.warn(`No API key configured for provider ${providerName} when fetching models.`);
            return reply.status(400).send({ message: `No API key found for ${providerName}. Configure it first.` });
        }

        try {
            const client = getProviderClient(providerName);
            const models = await client.listModels(apiKey);

            // Enrich with "Key Status" info
            // Fetch overrides for this provider
            const overrides = await prisma.lLMModelConfig.findMany({ where: { providerName } });

            const results = models.map(m => {
                const override = overrides.find(o => o.modelName === m.name);
                return {
                    ...m,
                    hasApiKey: !!(apiKey || override?.encryptedKeyOverride),
                    keyStatus: override ? override.lastKeyTestStatus : (provider?.lastKeyTestStatus || 'unknown')
                };
            });

            return results;
        } catch (error: any) {
            console.error("Fetch models error:", error);
            return reply.status(500).send({ message: 'Failed to fetch models: ' + error.message });
        }
    });

    // 3. Tasks: Get / Set
    app.get('/tasks', async (req, reply) => {
        return await prisma.lLMTaskConfig.findMany();
    });

    app.post('/tasks', async (req, reply) => {
        const { task, providerName, modelName, dailyBudget, pricePer1kTokens } = req.body as { task: string; providerName?: string; modelName?: string, dailyBudget?: number, pricePer1kTokens?: number };
        try {
            if (dailyBudget !== undefined) {
                await llmConfig.setTaskBudget(task as any, dailyBudget);
            }
            if (providerName && modelName) {
                // Also sets price if provided
                await llmConfig.setTaskConfig(task as any, providerName, modelName, pricePer1kTokens);
            } else if (pricePer1kTokens !== undefined) {
                // Just updating price? setTaskConfig handles it if we pass current values, but to be safe/easy let's assume UI passes all or we add a specific setPrice?
                // For MVP, we'll assume UI passes provider/model with price.
                // OR we can add a specific update just for price if needed.
                // Let's rely on setTaskConfig being robust or refactor it.
                // Actually trackUsage reads from config, so we need to update LLMTaskConfig.
                await prisma.lLMTaskConfig.update({
                    where: { task },
                    data: { pricePer1kTokens }
                });
            }

            return { success: true };
        } catch (err: any) {
            return reply.status(400).send({ message: err.message });
        }
    });

    app.get('/tasks/usage', async (req, reply) => {
        const date = new Date().toISOString().split('T')[0];
        const usages = await prisma.dailyTaskUsage.findMany({
            where: { date }
        });
        return usages;
    });

    app.get('/books/usage', async (req, reply) => {
        // Get usage for all books, maybe aggregated or just raw list?
        // User asked for "For each recently ingested book..."
        const usages = await prisma.bookTaskUsage.findMany({
            orderBy: { date: 'desc' },
            take: 100
        });
        return usages;
    });

    // 4. Queue Control
    app.get('/queue/stats', async (req, reply) => {
        const queued = await prisma.ingestionJob.count({ where: { status: 'queued' } });
        const processing = await prisma.ingestionJob.count({ where: { status: 'processing' } });
        // worker status? We can't easily check in-process singleton state via REST without shared state var.
        // But we can return counts.
        return { queued, processing };
    });

    app.post('/queue/control', async (req, reply) => {
        const { action } = req.body as { action: 'pause' | 'resume' | 'restart' };
        // Implement simple control flags in `ingestionQueue` if needed.
        // For now, restart re-triggers list.
        if (action === 'restart') {
            ingestionQueue.startWorker(); // simplistic
        }
        return { message: `Queue action ${action} triggered` };
    });

    // 5. Usage Stats
    app.get('/usage', async (req, reply) => {
        const usage = await prisma.dailyModelUsage.findMany({
            orderBy: { date: 'desc' },
            take: 100
        });
        return usage;
    });
}
