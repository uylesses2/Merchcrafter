
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { orchestratorService } from '../services/orchestratorService';

export async function orchestratorRoutes(app: FastifyInstance) {
    // Phase 0
    app.post('/phase0', {
        schema: {
            body: z.object({
                entityId: z.string(),
                entityType: z.string(),
                analyzedTraits: z.string(),
                focusText: z.string().optional(),
                stylePreset: z.string(),
                aspectRatio: z.string(),
                constraints: z.string().optional(),
            }),
        },
    }, async (request) => {
        return orchestratorService.phase0_QuickCreate(request.body as any);
    });

    // Phase 1
    app.post('/phase1', {
        schema: {
            body: z.object({
                entityId: z.string(),
                entityType: z.string(),
                anchorImageId: z.number(),
                canonScope: z.enum(['character_model', 'non_character_entity']),
            }),
        },
    }, async (request) => {
        return orchestratorService.phase1_CanonUpgrade(request.body as any);
    });

    // Phase 2A
    app.post('/phase2a', {
        schema: {
            body: z.object({
                entityId: z.string(),
                turnaroundMode: z.string(),
                sheetLayout: z.string().optional(),
                background: z.string().optional(),
                lighting: z.string().optional(),
            }),
        },
    }, async (request) => {
        return orchestratorService.phase2A_Turnaround(request.body as any);
    });

    // Phase 2B
    app.post('/phase2b', {
        schema: {
            body: z.object({
                entityId: z.string(),
                expressionsList: z.array(z.string()).optional(),
                background: z.string().optional(),
                lighting: z.string().optional(),
            }),
        },
    }, async (request) => {
        return orchestratorService.phase2B_FaceSheet(request.body as any);
    });

    // Phase 2C
    app.post('/phase2c', {
        schema: {
            body: z.object({
                entityId: z.string(),
                turnaroundSheetUrl: z.string(),
                faceSheetUrl: z.string().optional(),
                expectedLayout: z.string().optional(),
            }),
        },
    }, async (request) => {
        return orchestratorService.phase2C_Cropping(request.body as any);
    });

    // Phase 3
    app.post('/phase3', {
        schema: {
            body: z.object({
                entityId: z.string(),
                userTraits: z.object({
                    palette: z.string().optional(),
                    materials: z.string().optional(),
                    cleanliness: z.string().optional(),
                    vibe: z.string().optional(),
                    gearOverrides: z.string().optional(),
                }),
                forbidden: z.array(z.string()).optional(),
            }),
        },
    }, async (request) => {
        return orchestratorService.phase3_TraitInfluence(request.body as any);
    });

    // Phase 4
    app.post('/phase4', {
        schema: {
            body: z.object({
                projectId: z.number(),
                outputPreset: z.string(),
                selectedEntities: z.array(z.object({
                    entityId: z.string(),
                    role: z.string(),
                })),
                selectedRefImages: z.array(z.string()),
                traitBlock: z.string(),
                compositionNotes: z.string().optional(),
                constraints: z.string().optional(),
                aspectRatio: z.string().optional(),
            }),
        },
    }, async (request) => {
        return orchestratorService.phase4_Composition(request.body as any);
    });
}
