import { LLMClient, LLMImageOptions, LLMGenerateOptions, LLMEmbedOptions } from './types';
import { GeminiClient } from './gemini';
import { OpenAIClient } from './openai'; // Todo

// Placeholder until implementation
class PlaceholderClient implements LLMClient {
    async testKey(apiKey: string): Promise<boolean> { return true; }
    async listModels(apiKey: string) { return []; }
    async generateContent() { return "Placeholder"; }
    async embedTexts() { return []; }
    async labelMicroFragments() { return []; }
    async generateImage(): Promise<string[]> { throw new Error("Method not implemented."); }
}

export function getProviderClient(providerName: string): LLMClient {
    switch (providerName.toLowerCase()) {
        case 'gemini':
            return new GeminiClient();
        case 'openai':
            return new OpenAIClient();
        default:
            throw new Error(`Unknown provider: ${providerName}`);
    }
}
