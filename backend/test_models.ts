import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

    // There isn't a direct listModels method on the genAI instance in some versions,
    // but let's try to infer or run a simple generation with a known "safe" model like 'gemini-pro' (which failed)
    // or 'gemini-1.0-pro'.

    // Actually, simply printing the error from before, it said: "Call ListModels to see the list..."
    // Unfortunately the SDK might not expose listModels directly easily in the main class in older versions.
    // But let's check package version first (handled by parallel tool).

    // Let's try 'gemini-1.0-pro' as a fallback test here.
    const modelsToTry = ["gemini-1.0-pro", "gemini-pro", "gemini-1.5-flash-latest"];

    for (const m of modelsToTry) {
        console.log(`Testing model: ${m}...`);
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Test");
            console.log(`✅ ${m} WORKS!`);
            return;
        } catch (e: any) {
            console.log(`❌ ${m} failed: ${e.message.split('\n')[0]}`);
        }
    }
}

listModels();
