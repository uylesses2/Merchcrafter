
import { CREATIVE_PRESETS, CreativePreset } from './presets';
import { isWeaponLike } from './analysisRegistry';
import { EntityType } from './analysisRegistry';

interface SuggestionInput {
    entityType: string;
    entityName: string;
    analysisResult: any; // visual analysis result
    userSelections?: {
        format?: string;
        style?: string;
        use?: string;
    };
}

export interface PresetSuggestion {
    presetId: string;
    score: number;
    reasons: string[];
    preset: CreativePreset;
}

export function suggestPresets(input: SuggestionInput): PresetSuggestion[] {
    const { entityType, entityName, analysisResult, userSelections } = input;
    const scores: PresetSuggestion[] = CREATIVE_PRESETS.map(preset => ({
        presetId: preset.id,
        score: 0,
        reasons: [],
        preset
    }));

    // Helper to get attribute value safely
    const getAttr = (key: string): string => {
        // Handle flattened or nested structure
        if (analysisResult[key]) {
            if (typeof analysisResult[key] === 'string') return analysisResult[key];
            if (analysisResult[key].value) return analysisResult[key].value;
        }
        // Handle array of attributes style
        if (Array.isArray(analysisResult.attributes)) {
            const found = analysisResult.attributes.find((a: any) => a.key === key || a.name === key);
            if (found) return found.value;
        }
        return '';
    };

    const attributes = analysisResult.attributes || analysisResult; // Fallback
    const itemType = getAttr('itemType');
    const isWeapon = isWeaponLike(entityName, itemType);

    scores.forEach(s => {
        const p = s.preset;

        // 1. Compatibility Filter (Hard Constraint)
        if (!p.compatibleEntityTypes.includes('*') && !p.compatibleEntityTypes.includes(entityType)) {
            s.score = -100; // Disqualify
            return;
        }

        // 2. Entity Type Affinity
        if (p.compatibleEntityTypes.includes(entityType)) {
            s.score += 10;
        }

        // 3. Weapon Heuristic
        if (isWeapon && (p.tags?.includes('weapon'))) {
            s.score += 20;
            s.reasons.push("Optimized for weapons");
        }

        // 4. Detailed/Technical Heuristic
        const hasTechnicalFields = getAttr('dimensions') || getAttr('materials') || getAttr('mechanisms');
        if (hasTechnicalFields && (p.tags?.includes('technical') || p.tags?.includes('detailed'))) {
            s.score += 15;
            s.reasons.push("Matches technical detail level");
        }

        // 5. Organic Heuristic
        const isOrganic = ['MONSTER_OR_CREATURE', 'PLANT', 'ALIEN'].includes(entityType);
        if (isOrganic && p.tags?.includes('organic')) {
            s.score += 15;
            s.reasons.push("Suits organic subjects");
        }

        // 6. User Selection Affinity
        if (userSelections) {
            if (userSelections.use && p.recommended.use === userSelections.use) {
                s.score += 10;
                s.reasons.push(`Matches intended use: ${userSelections.use}`);
            }
            if (userSelections.style && p.recommended.style === userSelections.style) {
                s.score += 5;
            }
        }
    });

    return scores
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);
}

export function getCompatibilitySuggestions(entityType: string, itemType?: string): PresetSuggestion[] {
    return suggestPresets({
        entityType,
        entityName: 'LocalCheck',
        analysisResult: { itemType: { value: itemType } }
    });
}
