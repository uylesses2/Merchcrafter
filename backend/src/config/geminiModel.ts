export const GEMINI_GENERATION_MODEL = 'gemini-3-pro-preview';

/**
 * Validates the model name to ensure no Flash or 2.x models are used.
 * @param modelName The model name to check.
 */
export function validateGenerationModel(modelName: string) {
    if (modelName.toLowerCase().includes('flash') || modelName.includes('2.') || (modelName.includes('preview') && modelName !== GEMINI_GENERATION_MODEL)) {
        // Allow the specific preview model we want, but block others if needed, mostly blocking flash/2.x
        // The requirement is "NOT fall back to any flash or 2.x model"
    }

    if (modelName.toLowerCase().includes('flash') || modelName.startsWith('gemini-2')) {
        throw new Error(`[SECURITY] Flash models and Gemini 2.x are forbidden in MerchCrafter. Use ${GEMINI_GENERATION_MODEL}. Provided: ${modelName}`);
    }
}
