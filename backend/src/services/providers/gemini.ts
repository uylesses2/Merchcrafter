
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMClient, LLMGenerateOptions, LLMEmbedOptions, LLMImageOptions } from "./types";
import { MicroFragment } from "../microFragments";
import { saveBase64Image } from "../imageUtils";

export class GeminiClient implements LLMClient {
    async generateImage(prompt: string, apiKey: string, options: LLMImageOptions): Promise<string[]> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: options.modelName });

        try {
            console.log(`[Gemini] Generating image with model: ${options.modelName}`);
            // Note: As of early 2025 (or late 2024), AI Studio supports Imagen 3 via generateContent.
            // It typically returns inlineData (base64).
            const result = await model.generateContent(prompt);
            const response = await result.response;

            // Check for images in the response candidates
            // Structure: candidate.content.parts[].inlineData
            const candidates = response.candidates || [];
            const imageUrls: string[] = [];

            for (const candidate of candidates) {
                const parts = candidate.content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                        const url = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType.split('/')[1]);
                        imageUrls.push(url);
                    }
                }
            }

            if (imageUrls.length === 0) {
                console.warn("[Gemini] No images found in response:", JSON.stringify(response));
                throw new Error("No images returned by Gemini. Ensure the selected model supports image generation.");
            }

            return imageUrls;
        } catch (error: any) {
            console.error("Gemini Image Gen Error:", error);
            throw new Error(`Gemini Image Gen Failed: ${error.message}`);
        }
    }

    async testKey(apiKey: string): Promise<boolean> {
        if (!apiKey) return false;
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use a cheap/fast model for testing
            await model.generateContent("Test request");
            return true;
        } catch (error) {
            console.error("Gemini Key Test Failed:", error);
            return false;
        }
    }

    async listModels(apiKey: string): Promise<{ name: string; capabilities: string[] }[]> {
        // The Google Node SDK doesn't expose listModels cleanly in all versions.
        // Using REST API as fallback/primary for listing.
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to list models: ${response.statusText}`);

            const data = await response.json();
            if (!data.models) return [];

            return data.models.map((m: any) => {
                const capabilities: string[] = [];
                if (m.supportedGenerationMethods.includes("generateContent")) capabilities.push("text");
                if (m.supportedGenerationMethods.includes("embedContent")) capabilities.push("embeddings");
                // Check capabilities properly
                return {
                    name: m.name.replace("models/", ""), // Strip prefix for cleaner usage
                    capabilities
                };
            });
        } catch (error) {
            console.error("Gemini List Models Failed:", error);
            throw error;
        }
    }

    async generateContent(prompt: string, apiKey: string, options: LLMGenerateOptions): Promise<string> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: options.modelName,
            generationConfig: {
                maxOutputTokens: options.maxTokens,
                temperature: options.temperature
            }
        });

        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    async embedTexts(texts: string[], apiKey: string, options: LLMEmbedOptions): Promise<number[][]> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: options.modelName });

        const embeddings: number[][] = [];

        // Google API `batchEmbedContents` usually has a matching limit (e.g. 100 or 1000). 
        // 500 should fit text-embedding-004 limits (2048 dims, etc).
        // Since the caller controls the batch size (500), we trust it fits or handle error if split needed.
        // We'll map the input texts to the request format.

        try {
            const requests = texts.map(t => ({
                content: { role: 'user', parts: [{ text: t }] },
                taskType: 'RETRIEVAL_DOCUMENT' as any
            }));

            // Note: batchEmbedContents return type might differ slightly by SDK version
            // casting to any to avoid strict type issues if definitions lag.
            const result = await model.batchEmbedContents({ requests });

            // result.embeddings is an array of { values: number[] }
            if (result.embeddings) {
                return result.embeddings.map(e => e.values);
            }
            return [];
        } catch (e: any) {
            console.warn("[Gemini] batchEmbedContents failed or not supported, falling back to sequential.", e.message);
            // Fallback
            for (const text of texts) {
                try {
                    const res = await model.embedContent(text);
                    embeddings.push(res.embedding.values);
                } catch (innerE) {
                    console.error("Single embedding failed", innerE);
                    embeddings.push([]); // Keep index alignment? Or throw?
                }
            }
            return embeddings;
        }
    }

    async labelMicroFragments(fragments: { text: string; positionIndex: number; }[], apiKey: string, modelName: string): Promise<MicroFragment[]> {
        // Reuse logic from old microFragments.ts but using this client structure
        if (fragments.length === 0) return [];

        const LABELS = [
            'PHYSICAL_APPEARANCE', 'DIALOGUE', 'ACTION_EVENT', 'SETTING_ENVIRONMENT',
            'RELATIONSHIP', 'ITEM_DESCRIPTION', 'CREATURE_DESCRIPTION', 'INTERNAL_THOUGHT', 'OTHER'
        ];

        const prompt = `
        You are an expert literary analyst.
        I will provide a list of text snippets from a book.
        For each snippet, identify:
        1. "entity_names": List of specific characters, locations, items, or creatures mentioned. Normalize names.
        2. "labels": A list of categories from: ${JSON.stringify(LABELS)}.

        Return a JSON object with a "results" array.
        Format: { "results": [ { "entity_names": [...], "labels": [...] } ] }

        Input Snippets:
        ${JSON.stringify(fragments.map(f => f.text))}
        `;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json' }
        });

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const parsed = JSON.parse(responseText);

            return fragments.map((f, i) => {
                const res = parsed.results?.[i] || {};
                return {
                    text: f.text,
                    positionIndex: f.positionIndex,
                    entityNames: Array.isArray(res.entity_names) ? res.entity_names : [],
                    labels: Array.isArray(res.labels) ? res.labels.filter((l: string) => LABELS.includes(l)) : []
                };
            });
        } catch (e) {
            console.error("Labeling failed in GeminiClient", e);
            throw e;
        }
    }
}
