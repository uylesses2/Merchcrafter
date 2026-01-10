import { z } from 'zod';
import { ImageFormatEnum, ArtStyleEnum, OutputUseEnum } from './imageTypes';
import { EntityType } from './analysisRegistry';
import { AttributeValue } from './analysisTypes';

// --- Zod Schema for the strict JSON prompt ---

export const ImagePromptJSONSchema = z.object({
    version: z.literal('1.0'),
    entity: z.object({
        id: z.string().optional(),
        name: z.string(),
        type: z.string(), // Keeping string to allow flexibility, typically EntityType
        subtype: z.string().optional()
    }),
    depiction: z.object({
        format: ImageFormatEnum,
        artStyles: z.array(ArtStyleEnum),
        composition: z.object({
            background: z.string().nullable(),
            poseOrView: z.string().nullable(),
            camera: z.string().nullable()
        }),
        constraints: z.object({
            noText: z.boolean().optional(),
            safeForMerch: z.boolean().optional(),
            avoidCopyrightLikeness: z.boolean().optional()
        }).optional()
    }),
    facts: z.object({
        attributes: z.record(z.any()), // maps to AttributeValue<any>
        requiredKeys: z.array(z.string())
    }),
    negatives: z.array(z.string()),
    provenance: z.object({
        bookId: z.string().optional(),
        projectId: z.string().optional(),
        analysisId: z.string().optional()
    })
});

export type ImagePromptJSON = z.infer<typeof ImagePromptJSONSchema>;


// --- Builder Helper ---

interface BuildPromptInput {
    entity: { id?: string; name: string; type: string; subtype?: string };
    analysisResult: Record<string, AttributeValue<string>>; // Flattened attributes
    creative: {
        format: string; // ImageFormat
        styles: string[]; // ArtStyle[]
        composition?: { background?: string; pose?: string; camera?: string };
        constraints?: { noText?: boolean };
    };
    provenance?: {
        bookId?: string;
        projectId?: string;
        analysisId?: string;
    };
    negatives?: string[];
}

export function buildImagePromptJSON(input: BuildPromptInput): ImagePromptJSON {
    // 1. Filter Attributes (facts)
    // We assume input.analysisResult is already normalized AttributeValue map
    // We treat all high confidence attributes as requiredKeys? 
    // Or just pass all of them.
    const attributes = input.analysisResult || {};
    const requiredKeys = Object.entries(attributes)
        .filter(([_, v]) => v && v.confidence >= 0.7) // High confidence keys are "required"
        .map(([k, _]) => k);

    // 2. Depiction defaults
    const styles = input.creative.styles.length > 0 ? input.creative.styles : ['DIGITAL_PAINTING'];

    // 3. Construct JSON
    return {
        version: '1.0',
        entity: {
            id: input.entity.id,
            name: input.entity.name,
            type: input.entity.type,
            subtype: input.entity.subtype
        },
        depiction: {
            format: input.creative.format as any,
            artStyles: styles as any,
            composition: {
                background: input.creative.composition?.background || null,
                poseOrView: input.creative.composition?.pose || null,
                camera: input.creative.composition?.camera || null
            },
            constraints: {
                noText: input.creative.constraints?.noText ?? true,
                safeForMerch: true,
                avoidCopyrightLikeness: true
            }
        },
        facts: {
            attributes,
            requiredKeys
        },
        negatives: input.negatives || ["low quality", "jpeg artifacts", "watermark", "text", "signature"],
        provenance: {
            bookId: input.provenance?.bookId,
            projectId: input.provenance?.projectId ? String(input.provenance.projectId) : undefined,
            analysisId: input.provenance?.analysisId
        }
    };
}

export function toJsonPrompt(payload: ImagePromptJSON): string {
    return JSON.stringify(payload, null, 2);
}
