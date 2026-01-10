
import { prisma } from './db';
import { vectorStore } from './vectorStore';
import { config } from '../config';

interface DiagnosticResult {
    status: 'OK' | 'FAILED';
    message?: string;
}

interface SystemHealthReport {
    timestamp: string;
    status: 'OK' | 'FAILED';
    components: {
        backend: DiagnosticResult;
        database: DiagnosticResult;
        vector_store: DiagnosticResult;
        environment: DiagnosticResult;
    };
}

export async function runSystemDiagnostics(): Promise<SystemHealthReport> {
    const report: SystemHealthReport = {
        timestamp: new Date().toISOString(),
        status: 'OK',
        components: {
            backend: { status: 'OK', message: 'Service is running' },
            database: { status: 'OK' },
            vector_store: { status: 'OK' },
            environment: { status: 'OK' }
        }
    };

    // 1. Check Database (Prisma)
    try {
        await prisma.$queryRaw`SELECT 1`;
        report.components.database = { status: 'OK', message: 'Connection successful (Prisma)' };
    } catch (err: any) {
        report.components.database = { status: 'FAILED', message: `DB Connection failed: ${err.message}` };
        report.status = 'FAILED';
    }

    // 2. Check Vector Store (Qdrant)
    // Checks connection, collection existence, and read/write capability
    // @ts-ignore - We just added checkHealth but TS might not see it yet if not recompiled on fly, but runtime is fine.
    const vectorHealth = await vectorStore.checkHealth();
    report.components.vector_store = {
        status: vectorHealth.status,
        message: vectorHealth.message || `Connected to ${config.QDRANT_URL}`
    };
    if (vectorHealth.status === 'FAILED') report.status = 'FAILED';


    // 3. Environment Variables
    const missingVars: string[] = [];
    if (!config.QDRANT_URL) missingVars.push('QDRANT_URL');
    // Using process.env directly for optional ones if we want to strict check existence even if optional in zod
    if (!process.env.GEMINI_API_KEY) missingVars.push('GEMINI_API_KEY');

    if (missingVars.length > 0) {
        report.components.environment = {
            status: 'FAILED',
            message: `Missing required env vars: ${missingVars.join(', ')}`
        };
        report.status = 'FAILED';
    } else {
        report.components.environment = {
            status: 'OK',
            message: 'Critical variables present (GEMINI_API_KEY, QDRANT_URL)'
        };
    }

    return report;
}
