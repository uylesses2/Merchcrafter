
import { PrismaClient } from '@prisma/client';
import { llmConfig } from './llmConfig';

const prisma = new PrismaClient();

// In-memory cache for Global Toggle to avoid DB hits on every check
// We will refresh this periodically or on admin update.
let _globalDisableCache: boolean | null = null;
let _hasLoggedBypass = false;

export const budgetService = {

    // --- 1. Global Toggle ---

    async isGlobalLimitDisabled(): Promise<boolean> {
        if (_globalDisableCache === null) {
            const setting = await prisma.globalSettings.findUnique({ where: { key: 'disableUsageLimits' } });
            _globalDisableCache = setting?.value === 'true';
        }

        // Log once logic
        if (_globalDisableCache && !_hasLoggedBypass) {
            console.log('[BUDGET] Usage limits disabled (admin toggle)');
            _hasLoggedBypass = true;
        }

        return _globalDisableCache;
    },

    async setGlobalLimitDisabled(disabled: boolean) {
        await prisma.globalSettings.upsert({
            where: { key: 'disableUsageLimits' },
            update: { value: String(disabled) },
            create: { key: 'disableUsageLimits', value: String(disabled) }
        });
        _globalDisableCache = disabled;

        // Reset log flag if we are enabling limits again?
        // Requirement says "log once per server process lifetime (until restart)". 
        // So we do NOT reset _hasLoggedBypass if toggled off then on.
    },

    // --- 2. Check & Charge ---

    async checkBudget(taskType: string, modelName: string, cost: number = 1): Promise<{ allowed: boolean, reason?: string }> {
        // 1. Global Bypass
        if (await this.isGlobalLimitDisabled()) {
            return { allowed: true };
        }

        const date = new Date().toISOString().split('T')[0];

        // 2. Task Budget Check
        const taskConfig = await prisma.lLMTaskConfig.findUnique({ where: { task: taskType } });
        // Default: Enabled=true, Budget=10000 (if no config, implied defaults)
        const taskBudgetEnabled = taskConfig?.budgetEnabled ?? true;
        const taskDailyLimit = taskConfig?.dailyBudget ?? 10000;

        if (taskBudgetEnabled) {
            const taskUsage = await prisma.dailyTaskUsage.findUnique({
                where: { date_task: { date, task: taskType } }
            });
            const used = taskUsage?.count || 0;
            if (used + cost > taskDailyLimit) {
                return { allowed: false, reason: `Daily budget exceeded for task '${taskType}' (${used}/${taskDailyLimit})` };
            }
        }

        // 3. Model Budget Check
        // We need providerName to verify? Usually passed or inferred. 
        // For simple model budget, we assume modelName is unique enough or we query by modelName only?
        // Schema has @@unique([providerName, modelName]).
        // Wait, multiple providers might have same model name (rare but possible).
        // Check LLMModelConfig. We'll search by modelName only or iterate.
        // Let's assume we find the FIRST matching config for this modelName if provider unknown.
        // Better: Caller should pass provider. But signature says checkBudget(task, model, cost).
        // We will try to find config by modelName.
        const modelConfig = await prisma.lLMModelConfig.findFirst({ where: { modelName } });

        const modelBudgetEnabled = modelConfig?.budgetEnabled ?? true;
        const modelDailyLimit = modelConfig?.dailyBudget ?? 10000;

        if (modelBudgetEnabled) {
            // Find usage for this model across ALL providers?
            // DailyModelUsage has providerName + modelName logic.
            // We should sum up? Or pick specific?
            // "Shared pool per exact model string across all tasks".
            // So we sum all providers for this modelName? Or enforce provider-specific?
            // "A 'model' is the exact model identifier string... shared daily budget for that model."
            // This implies we aggregate by modelName.
            const modelUsages = await prisma.dailyModelUsage.findMany({
                where: { date, modelName }
            });
            const totalUsed = modelUsages.reduce((sum, u) => sum + u.requests, 0);

            if (totalUsed + cost > modelDailyLimit) {
                return { allowed: false, reason: `Daily budget exceeded for model '${modelName}' (${totalUsed}/${modelDailyLimit})` };
            }
        }

        return { allowed: true };
    },

    async chargeBudget(taskType: string, modelName: string, providerName: string, cost: number = 1, tokensIn: number = 0, tokensOut: number = 0) {
        const date = new Date().toISOString().split('T')[0];

        // 1. Task Usage
        // Calculate Cost? (Keep existing logic or simplify?)
        // Existing logic in llmConfig used pricePer1k.
        // We should invoke llmConfig.trackUsage or replicate minimal logic here?
        // Let's call llmConfig.trackUsage to keep price logic consistent for TASKS.
        await llmConfig.trackUsage(taskType as any, tokensIn, tokensOut); // This handles DailyTaskUsage

        // 2. Model Usage (New)
        await prisma.dailyModelUsage.upsert({
            where: { date_providerName_modelName: { date, providerName, modelName } },
            update: {
                requests: { increment: cost },
                inputTokens: { increment: tokensIn },
                outputTokens: { increment: tokensOut }
            },
            create: {
                date,
                providerName,
                modelName,
                requests: cost,
                inputTokens: tokensIn,
                outputTokens: tokensOut
            }
        });
    },

    // --- 3. Preflight Ops ---

    async performIngestionPreflight(bookId: string, chaptersCount: number): Promise<{ pass: boolean, error?: string }> {
        // Estimates
        // 1. Scene Extraction: 1 call per chapter (Model: 'sceneExtraction')
        // 2. Embeddings: Approximation? Can we know char count?
        //    If strictly strictly 'sceneExtraction' is the blocker, check that first.
        //    Requirement says "At minimum, cover sceneExtraction".

        if (await this.isGlobalLimitDisabled()) return { pass: true };

        // Get Task Config for Scene Extraction to know the model
        // We assume 'sceneExtraction' is the task name.
        const taskConfig = await prisma.lLMTaskConfig.findUnique({ where: { task: 'sceneExtraction' } });
        const targetModel = taskConfig?.modelName || 'gemini-1.5-flash'; // Default guess if missing

        // Check Scene Extraction Budget
        const cost = chaptersCount;
        const check = await this.checkBudget('sceneExtraction', targetModel, cost);

        if (!check.allowed) {
            return {
                pass: false,
                error: `Preflight Check Failed: Ingestion requires ~${cost} calls for scene extraction. ${check.reason}. Please increase budget or enable 'Disable Usage Limits'.`
            };
        }

        return { pass: true };
    }
};
