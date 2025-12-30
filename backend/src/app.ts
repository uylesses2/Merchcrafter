import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { config } from './config';

export async function buildApp(): Promise<FastifyInstance> {
    const app = fastify({
        logger: true,
    });

    // Validation
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // Plugins
    await app.register(cors);
    await app.register(fastifyJwt, {
        secret: config.JWT_SECRET,
    });

    app.decorate('authenticate', async (request: any, reply: any) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // Health check
    app.get('/health', async () => ({ status: 'ok' }));

    // Register routes
    await app.register(import('./routes/auth').then(m => m.authRoutes), { prefix: '/api/auth' });
    await app.register(import('./routes/projects').then(m => m.projectRoutes), { prefix: '/api/projects' });
    await app.register(import('./routes/generate').then(m => m.generateRoutes), { prefix: '/api/generate' });
    await app.register(import('./routes/billing').then(m => m.billingRoutes), { prefix: '/api/billing' });
    await app.register(import('./routes/admin').then(m => m.adminRoutes), { prefix: '/api/admin' });

    return app;
}
