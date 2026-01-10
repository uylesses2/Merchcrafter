
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient(); // Or shared instance

interface UsageIncrement {
    requests?: number;
    inputTokens?: number;
    outputTokens?: number;
}

export const modelUsage = {
    async getTodayUsage(providerName: string, modelName: string) {
        const today = new Date().toISOString().split('T')[0];

        const record = await prisma.dailyModelUsage.findUnique({
            where: {
                date_providerName_modelName: {
                    date: today,
                    providerName,
                    modelName
                }
            }
        });

        return record || { requests: 0, inputTokens: 0, outputTokens: 0 };
    },

    async incrementUsage(providerName: string, modelName: string, usage: UsageIncrement) {
        const today = new Date().toISOString().split('T')[0];

        await prisma.dailyModelUsage.upsert({
            where: {
                date_providerName_modelName: {
                    date: today,
                    providerName,
                    modelName
                }
            },
            create: {
                date: today,
                providerName,
                modelName,
                requests: usage.requests || 0,
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0
            },
            update: {
                requests: { increment: usage.requests || 0 },
                inputTokens: { increment: usage.inputTokens || 0 },
                outputTokens: { increment: usage.outputTokens || 0 }
            }
        });
    }
}
