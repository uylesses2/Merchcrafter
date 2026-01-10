
import { MicroFragment } from '../microFragments';

export interface LLMGenerateOptions {
    modelName: string;
    maxTokens?: number;
    temperature?: number;
}

export interface LLMEmbedOptions {
    modelName: string;
    batchSize?: number;
}

export interface LLMImageOptions {
    modelName: string;
    width?: number;
    height?: number;
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
    n?: number;
}

export interface LLMClient {
    /**
     * Tests the validity of an API key by making a simple request (e.g. list models or small generation).
     * returning true if valid, false if invalid/unauthorized. 
     * Should throw errors only for network/other issues? Or return boolean is safer.
     */
    testKey(apiKey: string): Promise<boolean>;

    /**
     * Lists available models from the provider.
     * Rejects if API key is invalid.
     */
    listModels(apiKey: string): Promise<{ name: string; capabilities: string[] }[]>;

    generateContent(
        prompt: string,
        apiKey: string,
        options: LLMGenerateOptions
    ): Promise<string>;

    embedTexts(
        texts: string[],
        apiKey: string,
        options: LLMEmbedOptions
    ): Promise<number[][]>;

    labelMicroFragments(
        fragments: { text: string; positionIndex: number }[],
        apiKey: string,
        modelName: string
    ): Promise<MicroFragment[]>;

    generateImage(
        prompt: string,
        apiKey: string,
        options: LLMImageOptions
    ): Promise<string[]>; // Returns array of image URLs
}
