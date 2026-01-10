
import { FastifyInstance } from 'fastify';
import { buildImagePromptJSON } from '@merchcrafter/shared';

export async function imagesRoutes(fastify: FastifyInstance) {
    fastify.post('/prompt-json', async (request, reply) => {
        const body = request.body as any;

        // Ensure we handle defaults if missing
        const creativeSelection = {
            format: body.imageFormat,
            style: body.artStyle,
            use: body.outputUse,
            presetId: body.presetId,
            constraints: body.constraints
        };

        const jsonPrompt = buildImagePromptJSON({
            entityName: body.entityName,
            entityType: body.entityType,
            analysisResult: body.analysisResult,
            creativeSelection,
            focusText: body.focusText
        });

        return jsonPrompt;
    });
}
