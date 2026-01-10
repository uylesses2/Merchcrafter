
import { llmConfig } from "./llmConfig";
import { getProviderClient } from "./providers/factory";

export interface MicroFragment {
    text: string;
    positionIndex: number;
    entityNames: string[];
    labels: string[];
}

// Allowed Labels Enum equivalent
export const LABELS = [
    'PHYSICAL_APPEARANCE',
    'DIALOGUE',
    'ACTION_EVENT',
    'SETTING_ENVIRONMENT',
    'RELATIONSHIP',
    'ITEM_DESCRIPTION',
    'CREATURE_DESCRIPTION',
    'INTERNAL_THOUGHT',
    'OTHER'
];

/**
 * Splits text into micro-fragments (sentences or short groupings).
 * Simple heuristic: Split by sentence terminators, group if too short.
 */
export function splitIntoMicroFragments(text: string): { text: string; positionIndex: number }[] {
    // 1. Split by sentence endings (. ! ?) taking care of common abbreviations (simplistic)
    // Using a simple regex for now.
    const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];

    const fragments: { text: string; positionIndex: number }[] = [];
    let currentChunk = "";

    // Group very short sentences to avoid noise
    for (const s of sentences) {
        const trimmed = s.trim();
        if (!trimmed) continue;

        if (currentChunk.length + trimmed.length < 100) {
            currentChunk += " " + trimmed;
        } else {
            if (currentChunk) fragments.push({ text: currentChunk.trim(), positionIndex: fragments.length });
            currentChunk = trimmed;
        }
    }
    if (currentChunk) fragments.push({ text: currentChunk.trim(), positionIndex: fragments.length });

    return fragments;
}

/**
 * Labels a batch of micro-fragments using the configured LLM provider.
 */
export async function labelMicroFragments(fragments: { text: string; positionIndex: number }[]): Promise<MicroFragment[]> {
    if (fragments.length === 0) return [];

    try {
        const config = await llmConfig.getTaskConfig('microFragmentLabeling');
        const client = getProviderClient(config.providerName);

        return await client.labelMicroFragments(fragments, config.apiKey, config.modelName);

    } catch (error) {
        console.error("[Labeling] Critical Failure:", error);
        // Fallback: Return unlabeled
        return fragments.map(f => ({ ...f, entityNames: [], labels: [] }));
    }
}
