import { buildApp } from './app';
import { config } from './config';

async function main() {
    const app = await buildApp();

    try {
        await app.listen({ port: config.PORT, host: '0.0.0.0' });
        console.log(`🚀 Server running on http://localhost:${config.PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();
