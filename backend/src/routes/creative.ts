
import { FastifyInstance } from 'fastify';
import { CREATIVE_PRESETS, suggestPresets } from '@merchcrafter/shared';

export async function creativeRoutes(fastify: FastifyInstance) {
    fastify.get('/presets', async (request, reply) => {
        return CREATIVE_PRESETS;
    });

    fastify.post('/suggest', async (request, reply) => {
        const body = request.body as any;
        const suggestions = suggestPresets({
            entityType: body.entityType,
            entityName: body.entityName,
            analysisResult: body.analysisResult,
            userSelections: body.userSelections
        });

        // Return top 3
        return suggestions.slice(0, 3);
    });
}
