
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env directly since we are running standalone
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function listModels() {
    console.log("Checking models with API Key ending in...", process.env.GEMINI_API_KEY?.slice(-4));
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    // Note: The Node SDK might not expose listModels directly easily on the main class in all versions, 
    // but we can try the ModelManager if available or just use a raw fetch.
    // Actually, accessing the model list via REST is safer if SDK is vague.

    // Using raw fetch to be sure
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: any) => {
                console.log(`- ${m.name} (${m.displayName}) [${m.supportedGenerationMethods.join(', ')}]`);
            });
        } else {
            console.error("No models found or error:", data);
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

listModels();
