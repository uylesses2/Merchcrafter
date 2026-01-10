import { buildApp } from './app';
import { config } from './config';
import { ensurePortIsClear } from './lib/port-killer';
import { vectorStore } from './services/vectorStore';
import { runSystemDiagnostics } from './services/diagnostics';

async function main() {
    // Automatically clear port 3000 if it's stuck
    await ensurePortIsClear(config.PORT);

    // Init Vector Store (Qdrant)
    await vectorStore.init();

    const app = await buildApp();


    // Assuming buildApp() is where Fastify instance is created and plugins/routes are registered.
    // The instruction implies these registrations should happen within the app setup.
    // Since buildApp() content is not provided, we cannot directly insert the app.register calls here.
    // The imports are added as requested.
    // If the intention was to replace the main function with the provided Fastify setup,
    // the instruction would need to be more explicit about replacing the existing structure.

    try {
        await app.listen({ port: config.PORT, host: '0.0.0.0' });
        console.log(`🚀 Server running on http://localhost:${config.PORT}`);

        // Run startup diagnostics
        const report = await runSystemDiagnostics();
        const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
        const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
        const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;

        console.log('\n🔍 Startup Diagnostics:');

        // Backend (Self)
        console.log(`Backend:      ${green('OK')}`);

        // DB
        const db = report.components.database;
        console.log(`Database:     ${db.status === 'OK' ? green('OK') : red('FAILED')} ${db.status === 'FAILED' ? `(${db.message})` : ''}`);

        // Vector
        const vec = report.components.vector_store;
        console.log(`Vector Store: ${vec.status === 'OK' ? green('OK') : red('FAILED')} ${vec.status === 'FAILED' ? `(${vec.message})` : ''}`);
        if (vec.status === 'FAILED') console.log(yellow(`  -> Check Docker container 'qdrant' or URL setting.`));

        // Env
        const env = report.components.environment;
        console.log(`Environment:  ${env.status === 'OK' ? green('OK') : red('FAILED')} ${env.status === 'FAILED' ? `(${env.message})` : ''}`);
        if (env.status === 'FAILED') console.log(yellow(`  -> Check .env file for missing keys.`));
        console.log(''); // newline
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();
