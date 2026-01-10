
import { PrismaClient } from '@prisma/client';
import { getProviderClient } from './providers/factory';

const prisma = new PrismaClient(); // Or import shared instance if available

export type TaskType = "embeddings" | "microFragmentLabeling" | "analyzer" | "imageGeneration" | "sceneExtraction" | "timelineResolution" | "visualAnalysis";

export interface ResolvedConfig {
    providerName: string;
    modelName: string;
    apiKey: string;
    settings?: any;
}

export const llmConfig = {
    /**
     * Resolves the configuration for a specific task.
     * Order:
     * 1. Get Task Config (Provider/Model)
     * 2. Check for Model-Specific Key Override
     * 3. Fallback to Provider-Default Key
     */
    async getTaskConfig(task: TaskType): Promise<ResolvedConfig> {
        // 1. Get Task Config
        const taskConfig = await prisma.lLMTaskConfig.findUnique({
            where: { task }
        });

        // Default Fallbacks if no config exists
        let providerName = taskConfig?.providerName;
        let modelName = taskConfig?.modelName;

        if (!providerName || !modelName) {
            // Define defaults per task
            if (task === 'embeddings') {
                providerName = 'gemini';
                modelName = 'text-embedding-004';
            } else if (task === 'microFragmentLabeling') {
                providerName = 'gemini';
                modelName = 'gemini-exp-1206';
            } else if (task === 'analyzer' || task === 'visualAnalysis') {
                providerName = 'gemini';
                modelName = 'gemini-1.5-flash';
            } else if (task === 'imageGeneration') {
                throw new Error("No Image Generation model configured in Admin Panel.");
            } else if (task === 'sceneExtraction') {
                providerName = 'gemini';
                modelName = 'gemini-2.0-flash-exp'; // Use fast model for large context
            } else if (task === 'timelineResolution') {
                providerName = 'gemini';
                modelName = 'gemini-1.5-flash';
            } else {
                providerName = 'gemini';
                modelName = 'gemini-1.5-flash';
            }
        }

        // 2. Get Keys (Provider & Override)
        const provider = await prisma.lLMProvider.findUnique({
            where: { name: providerName }
        });

        const modelConfig = await prisma.lLMModelConfig.findUnique({
            where: {
                providerName_modelName: {
                    providerName,
                    modelName
                }
            }
        });

        // 3. Resolve API Key
        // Priority: Override > Provider Default > Environment Variable (Legacy Fallback)
        let apiKey = modelConfig?.encryptedKeyOverride || provider?.encryptedKey;

        if (!apiKey) {
            // Legacy/Environment Fallback
            if (providerName === 'gemini') apiKey = process.env.GEMINI_API_KEY;
            if (providerName === 'openai') apiKey = process.env.OPENAI_API_KEY;
        }

        if (!apiKey) {
            throw new Error(`No API Key configured for task '${task}' (Provider: ${providerName}, Model: ${modelName})`);
        }

        return {
            providerName,
            modelName,
            apiKey,
            settings: provider?.settings ? JSON.parse(provider.settings) : undefined
        };
    },

    async setProviderConfig(name: string, apiKey: string, settings?: any) {
        // Verify Key First
        const client = getProviderClient(name);
        const isValid = await client.testKey(apiKey);
        const status = isValid ? 'valid' : 'invalid';

        return await prisma.lLMProvider.upsert({
            where: { name },
            update: {
                encryptedKey: apiKey,
                settings: settings ? JSON.stringify(settings) : undefined,
                lastKeyTestStatus: status,
                lastKeyTestedAt: new Date()
            },
            create: {
                name,
                encryptedKey: apiKey,
                settings: settings ? JSON.stringify(settings) : undefined,
                lastKeyTestStatus: status,
                lastKeyTestedAt: new Date()
            }
        });
    },

    async setTaskConfig(task: TaskType, providerName: string, modelName: string, pricePer1kTokens?: number) {
        // Ensure we have a key? Logic says "Only allow if at least some API keys source exists"
        // Check provider key or model override
        const provider = await prisma.lLMProvider.findUnique({ where: { name: providerName } });
        const modelConfig = await prisma.lLMModelConfig.findUnique({
            where: { providerName_modelName: { providerName, modelName } }
        });

        const hasKey = !!(provider?.encryptedKey || modelConfig?.encryptedKeyOverride || (providerName === 'gemini' && process.env.GEMINI_API_KEY));

        if (!hasKey) {
            console.warn(`[Config] Setting task ${task} to ${providerName}/${modelName} but NO KEY FOUND.`);
            // Throwing error might block UI "Save", but prompt says "show error and log warning".
            // We'll throw here so the controller catches it.
            throw new Error("No API Key found for this provider/model combination.");
        }

        // Also warn if invalid?
        if (provider?.lastKeyTestStatus === 'invalid' && modelConfig?.lastKeyTestStatus !== 'valid') {
            console.warn(`[Config] Warning: Provider key for ${providerName} is marked invalid.`);
        }

        const data: any = { providerName, modelName };
        if (pricePer1kTokens !== undefined) {
            data.pricePer1kTokens = pricePer1kTokens;
        }

        return await prisma.lLMTaskConfig.upsert({
            where: { task },
            update: data,
            create: { task, ...data }
        });
    },

    async setTaskBudget(task: TaskType, limit: number) {
        return await prisma.lLMTaskConfig.update({
            where: { task },
            data: { dailyBudget: limit }
        });
    },

    async getDailyUsage(task: TaskType): Promise<{ count: number, limit: number }> {
        const date = new Date().toISOString().split('T')[0];

        // 1. Check for Global Bypass (Testing Mode)
        const disableLimitsEnv = process.env.DISABLE_USAGE_LIMITS || '';
        const isBypassed = ['true', '1', 'yes'].includes(disableLimitsEnv.toLowerCase());

        if (isBypassed) {
            // Log once per runtime to warn user
            // We use a property on the object to track logging to avoid global pollution if possible, 
            // but module-level var is simpler. Let's rely on a module-level var defined outside.
            // Actually, we can attach it to the singleton `llmConfig` if we cast it, or just use a module var.
            // Let's use a static-like property pattern or module scope variable.
            if (!(global as any).__HAS_LOGGED_BYPASS) {
                console.warn(`[BUDGET] Usage limits disabled via DISABLE_USAGE_LIMITS=true`);
                (global as any).__HAS_LOGGED_BYPASS = true;
            }
            // Return "effective" usage: real count, but limit is Infinity so check always passes.
            // But we still want to know the real usage? Yes.
            // Get Usage first
            const usage = await prisma.dailyTaskUsage.findUnique({
                where: { date_task: { date, task } }
            });
            return { count: usage?.count || 0, limit: Number.MAX_SAFE_INTEGER };
        }

        // Get Config (creates default if missing logic handled in getTaskConfig, but here we just read)
        // If no config row exists yet, we assume default 200.
        const config = await prisma.lLMTaskConfig.findUnique({ where: { task } });
        const limit = config?.dailyBudget ?? 200;

        // Get Usage
        const usage = await prisma.dailyTaskUsage.findUnique({
            where: { date_task: { date, task } }
        });

        return { count: usage?.count || 0, limit };
    },

    async incrementDailyUsage(task: TaskType) {
        // Deprecated by trackUsage, but kept for legacy calls if any.
        // Better to use trackUsage with 0 tokens if unknown.
        await this.trackUsage(task, 0, 0);
    },

    async trackUsage(task: TaskType, inputTokens: number, outputTokens: number, bookId?: string) {
        const date = new Date().toISOString().split('T')[0];

        // 1. Get Price
        const config = await prisma.lLMTaskConfig.findUnique({ where: { task } });
        const price = config?.pricePer1kTokens || 0.0;
        const totalTokens = inputTokens + outputTokens;
        const cost = (totalTokens / 1000) * price;

        // 2. Update Daily Usage
        await prisma.dailyTaskUsage.upsert({
            where: { date_task: { date, task } },
            update: {
                count: { increment: 1 },
                inputTokens: { increment: inputTokens },
                outputTokens: { increment: outputTokens },
                estimatedCost: { increment: cost }
            },
            create: {
                date, task,
                count: 1,
                inputTokens,
                outputTokens,
                estimatedCost: cost
            }
        });

        // 3. Update Book Usage (if bookId provided)
        if (bookId) {
            await prisma.bookTaskUsage.upsert({
                where: { bookId_task_date: { bookId, task, date } },
                update: {
                    requests: { increment: 1 },
                    inputTokens: { increment: inputTokens },
                    outputTokens: { increment: outputTokens },
                    estimatedCost: { increment: cost }
                },
                create: {
                    bookId, task, date,
                    requests: 1,
                    inputTokens,
                    outputTokens,
                    estimatedCost: cost
                }
            });
        }
    }
};
