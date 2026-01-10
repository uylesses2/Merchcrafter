import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const key = process.env.GEMINI_API_KEY;

async function listModelsRaw() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    console.log(`Fetching models from: ${url.replace(key!, 'HIDDEN_KEY')}`);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`HTTP Error: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error(`Response: ${text}`);
            return;
        }

        const data = await res.json();
        console.log("Available Models:");
        (data.models || []).forEach((m: any) => {
            console.log(`- ${m.name} (${m.supportedGenerationMethods?.join(', ')})`);
        });
    } catch (e: any) {
        console.error("Fetch failed:", e);
    }
}

listModelsRaw();
