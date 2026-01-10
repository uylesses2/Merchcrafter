import { buildImagePromptJSON, toJsonPrompt, ImagePromptJSON, ImagePromptJSONSchema } from '@merchcrafter/shared';

// Re-export for convenience
export { ImagePromptJSON };

export const ART_STYLES = [
    "ANIME_LINEWORK",
    "DA_VINCI_SKETCH",
    "PATENT_DRAWING",
    "ENGRAVING",
    "MINIMAL_VECTOR",
    "FANTASY_OIL",
    "MANGA_TECHNICAL",
    "WATERCOLOR_ILLUSTRATION",
    "DIGITAL_PAINTING",
    "MATTE_PAINTING",
    "RPG_ITEM_CARD"
];

// Preserving existing keys for UI compatibility (Formats)
export const MERCH_STYLES = [
    "TSHIRT_GRAPHIC",
    "POSTER_INFOGRAPHIC",
    "TECHNICAL_BLUEPRINT",
    "WEAPON_CARD",
    "STICKER",
    "BOOK_COVER_CONCEPT"
];

interface GeneratePromptInput {
    entityId?: string;
    entityName: string;
    entityType: string;
    entitySubtype?: string;
    analysisResult: any; // visual analysis result object (AttributeValue map)
    creativeSelection: {
        format: string;
        styles: string[];
        notes?: string;
    };
    provenance?: {
        bookId?: string;
        projectId?: number;
    };
}

/**
 * Generates a strict JSON prompt for the image provider.
 * This replaces all legacy text-based prompt generation.
 */
export function generateImagePrompt(input: GeneratePromptInput): string {
    // 1. Build Payload
    const payload = buildImagePromptJSON({
        entity: {
            id: input.entityId,
            name: input.entityName,
            type: input.entityType,
            subtype: input.entitySubtype
        },
        analysisResult: input.analysisResult,
        creative: {
            format: input.creativeSelection.format,
            styles: input.creativeSelection.styles,
            composition: {
                pose: input.creativeSelection.notes // Using notes as pose/view hint for now
            }
        },
        provenance: {
            bookId: input.provenance?.bookId,
            projectId: input.provenance?.projectId?.toString()
        }
    });

    // 2. Validate against Schema (Guard)
    const result = ImagePromptJSONSchema.safeParse(payload);
    if (!result.success) {
        throw new Error(`Invalid Image Prompt JSON: ${result.error.message}`);
    }

    // 3. Serialize to JSON
    return toJsonPrompt(payload);
}

/**
 * Provider Guard: Ensures a prompt string is valid JSON matching our schema.
 * Throws if invalid.
 */
export function validateProviderPrompt(jsonString: string): ImagePromptJSON {
    let obj: any;
    try {
        obj = JSON.parse(jsonString);
    } catch (e) {
        throw new Error("Prompt is not valid JSON string");
    }

    const parse = ImagePromptJSONSchema.safeParse(obj);
    if (!parse.success) {
        throw new Error(`Prompt JSON schema violation: ${parse.error.message}`);
    }
    return parse.data;
}
