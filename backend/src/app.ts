import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { config } from './config';
import multipart from '@fastify/multipart';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { generateRoutes } from './routes/generate';
import { billingRoutes } from './routes/billing';
import { adminRoutes } from './routes/admin';
import { bookRoutes } from './routes/books';
import { ragRoutes } from './routes/rag';
import { feedbackRoutes } from './routes/feedback';
import { healthRoutes } from './routes/health';
import { analysesRoutes } from './routes/analyses';
import { orchestratorRoutes } from './routes/orchestrator_routes';
import { generationsRoutes } from './routes/generations';
import { creativeRoutes } from './routes/creative';
import { imagesRoutes } from './routes/images';

export async function buildApp(): Promise<FastifyInstance> {
    const app = fastify({
        logger: true,
        bodyLimit: 104857600, // 100MB
    });

    // Validation
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // Plugins
    await app.register(cors);
    await app.register(fastifyJwt, {
        secret: config.JWT_SECRET,
    });
    await app.register(multipart, {
        limits: {
            fileSize: 104857600, // 100MB
        }
    });

    // Serve static files (generated images)
    const path = require('path');
    await app.register(require('@fastify/static'), {
        root: path.join(__dirname, '../public'),
        prefix: '/public/', // Accessible via /public/...
    });

    app.decorate('authenticate', async (request: any, reply: any) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // Register routes
    await app.register(healthRoutes, { prefix: '/health' });

    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(projectRoutes, { prefix: '/api/projects' });
    await app.register(generateRoutes, { prefix: '/api/generate' });
    await app.register(billingRoutes, { prefix: '/api/billing' });
    await app.register(adminRoutes, { prefix: '/api/admin' });
    await app.register(bookRoutes, { prefix: '/api/books' });
    await app.register(ragRoutes, { prefix: '/api/rag' });
    await app.register(feedbackRoutes, { prefix: '/api/feedback' });
    await app.register(analysesRoutes, { prefix: '/api/analyses' });

    await app.register(orchestratorRoutes, { prefix: '/api/orchestrator' });
    await app.register(generationsRoutes, { prefix: '/api/generations' });
    await app.register(creativeRoutes, { prefix: '/api/creative' });
    await app.register(imagesRoutes, { prefix: '/api/images' });

    return app;
}
