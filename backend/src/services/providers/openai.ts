
import OpenAI from "openai";
import { LLMClient, LLMGenerateOptions, LLMEmbedOptions, LLMImageOptions } from "./types";
import { MicroFragment } from "../microFragments";

export class OpenAIClient implements LLMClient {
    async testKey(apiKey: string): Promise<boolean> {
        if (!apiKey) return false;
        try {
            const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: false });
            await openai.models.list(); // Easiest check
            return true;
        } catch (error) {
            console.error("OpenAI Key Test Failed:", error);
            return false;
        }
    }

    async listModels(apiKey: string): Promise<{ name: string; capabilities: string[] }[]> {
        const openai = new OpenAI({ apiKey });
        const list = await openai.models.list();

        return list.data.map(m => {
            // Heuristic capabilities since OpenAI doesn't explicitly list them in this endpoint in a struct way
            // But we can guess by ID or assume standard models have text.
            const capabilities: string[] = ['text'];
            if (m.id.includes('embedding')) capabilities.push('embeddings');
            if (m.id.includes('dall-e')) capabilities.push('image');

            return {
                name: m.id,
                capabilities
            };
        });
    }

    async generateContent(prompt: string, apiKey: string, options: LLMGenerateOptions): Promise<string> {
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
            model: options.modelName,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: options.maxTokens,
            temperature: options.temperature
        });
        return response.choices[0].message.content || "";
    }

    async embedTexts(texts: string[], apiKey: string, options: LLMEmbedOptions): Promise<number[][]> {
        const openai = new OpenAI({ apiKey });
        // OpenAI allows batch embedding
        const response = await openai.embeddings.create({
            model: options.modelName,
            input: texts,
            encoding_format: "float"
        });
        return response.data.map(d => d.embedding);
    }

    async labelMicroFragments(fragments: { text: string; positionIndex: number; }[], apiKey: string, modelName: string): Promise<MicroFragment[]> {
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

        const openai = new OpenAI({ apiKey });
        const result = await openai.chat.completions.create({
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" }
        });

        const responseText = result.choices[0].message.content || "{}";
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
    }

    async generateImage(prompt: string, apiKey: string, options: LLMImageOptions): Promise<string[]> {
        const openai = new OpenAI({ apiKey });

        try {
            const response = await openai.images.generate({
                model: options.modelName,
                prompt: prompt,
                n: 1, // DALL-E 3 only supports n=1
                size: "1024x1024",
                quality: options.quality || "standard",
                style: options.style || "vivid",
            });

            const urls = response.data?.map(d => d.url || "") || [];
            return urls.filter(url => !!url);
        } catch (error) {
            console.error("OpenAI Image Generation Failed:", error);
            throw error;
        }
    }
}
