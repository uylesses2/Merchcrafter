import { describe, it, expect } from 'vitest';
import { validateProviderPrompt, generateImagePrompt } from './imagePrompting';

describe('validateProviderPrompt', () => {
    it('throws error if input is plain text', () => {
        const plainText = "Draw a dragon in a dungeon";
        expect(() => validateProviderPrompt(plainText)).toThrow(/valid JSON/);
    });

    it('throws error if JSON does not match schema', () => {
        const badJson = JSON.stringify({ prompt: "Draw a dragon" });
        expect(() => validateProviderPrompt(badJson)).toThrow(/schema violation/);
    });

    it('passes and returns object if valid', () => {
        const validJson = JSON.stringify({
            version: '1.0',
            entity: { name: 'E', type: 'T' },
            depiction: {
                format: 'POSTER_INFOGRAPHIC',
                artStyles: ['ANIME'],
                composition: { background: null, poseOrView: null, camera: null }
            },
            facts: { attributes: {}, requiredKeys: [] },
            negatives: [],
            provenance: {}
        });
        const result = validateProviderPrompt(validJson);
        expect(result.version).toBe('1.0');
    });
});
