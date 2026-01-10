import { describe, it, expect } from 'vitest'; // Assuming Vitest or Jest
import { ImagePromptJSONSchema, buildImagePromptJSON } from './prompting';

describe('ImagePromptJSONSchema', () => {
    it('validates a compliant JSON prompt', () => {
        const valid = {
            version: '1.0',
            entity: { name: 'Dracula', type: 'CHARACTER' },
            depiction: {
                format: 'POSTER_INFOGRAPHIC',
                artStyles: ['FANTASY_OIL'],
                composition: {
                    background: null,
                    poseOrView: null,
                    camera: null
                }
            },
            facts: {
                attributes: {},
                requiredKeys: []
            },
            negatives: [],
            provenance: {}
        };
        const result = ImagePromptJSONSchema.safeParse(valid);
        expect(result.success).toBe(true);
    });

    it('fails on missing version', () => {
        const invalid = {
            entity: { name: 'Dracula', type: 'CHARACTER' },
            // missing version
            depiction: {
                format: 'POSTER_INFOGRAPHIC',
                artStyles: ['FANTASY_OIL']
            }
        };
        const result = ImagePromptJSONSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });
});

describe('buildImagePromptJSON', () => {
    it('constructs a valid schema from minimal input', () => {
        const result = buildImagePromptJSON({
            entity: { name: 'Hero', type: 'CHARACTER' },
            analysisResult: {},
            creative: {
                format: 'TSHIRT_GRAPHIC',
                styles: ['ANIME']
            }
        });
        const parse = ImagePromptJSONSchema.safeParse(result);
        expect(parse.success).toBe(true);
        expect(result.depiction.format).toBe('TSHIRT_GRAPHIC');
    });
});
