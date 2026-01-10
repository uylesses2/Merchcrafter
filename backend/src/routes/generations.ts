
import { FastifyInstance } from 'fastify';
import { ArtStyleEnum, ImageFormatEnum, OutputUseEnum } from '@merchcrafter/shared';

export async function generationsRoutes(fastify: FastifyInstance) {
    fastify.get('/options', async (request, reply) => {
        return {
            formats: Object.values(ImageFormatEnum.enum),
            styles: Object.values(ArtStyleEnum.enum),
            uses: Object.values(OutputUseEnum.enum)
        };
    });
}
