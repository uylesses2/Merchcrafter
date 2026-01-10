
import { FastifyInstance } from 'fastify';
import { runSystemDiagnostics } from '../services/diagnostics';

// ANSI Color Codes for Terminal Output from Route (optional, but requested for server terminal log)
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;

function printDiagnosticSummary(report: any) {
    console.log('\n--- SYSTEM DIAGNOSTIC REQUESTED ---');
    console.log(`Backend:      ${green('OK')}`);

    const db = report.components.database;
    console.log(`Database:     ${db.status === 'OK' ? green('OK') : red('FAILED')} ${db.status === 'FAILED' ? `(${db.message})` : ''}`);

    const vec = report.components.vector_store;
    console.log(`Vector Store: ${vec.status === 'OK' ? green('OK') : red('FAILED')} ${vec.status === 'FAILED' ? `(${vec.message})` : ''}`);
    if (vec.status === 'FAILED') console.log(yellow(`  -> Check Docker container 'qdrant' or URL setting.`));

    const env = report.components.environment;
    console.log(`Environment:  ${env.status === 'OK' ? green('OK') : red('FAILED')} ${env.status === 'FAILED' ? `(${env.message})` : ''}`);
    if (env.status === 'FAILED') console.log(yellow(`  -> Check .env file for missing keys.`));

    console.log('-----------------------------------\n');
}

export async function healthRoutes(app: FastifyInstance) {
    // Standard quick health check (Load Balancers/Kubernetes)
    app.get('/', async () => ({ status: 'ok' }));

    // Full system diagnostic
    app.get('/full', async (request, reply) => {
        const report = await runSystemDiagnostics();

        // Log to server terminal as user requested
        printDiagnosticSummary(report);

        if (report.status === 'FAILED') {
            // Usually health checks return 503 if unhealthy, but sometimes 200 with error details is preferred for debugging.
            // Returning 200 here to ensure JSON is easily viewable in browser even if failed.
            return reply.status(200).send(report);
        }
        return report;
    });
}
