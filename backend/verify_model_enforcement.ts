import { generateEmbedding } from './src/services/rag';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config, MODEL_REASONING } from './src/config';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function verify() {
    console.log("1. Testing Embedding Enforcement...");
    try {
        const vec = await generateEmbedding("Test embedding");
        console.log(`✅ Embedding Success. Vector length: ${vec.length}`);
    } catch (e: any) {
        console.error(`❌ Embedding Failed: ${e.message}`);
    }

    console.log("\n2. Testing Reasoning Enforcement...");
    try {
        console.log(`Expected Model: ${MODEL_REASONING}`);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: MODEL_REASONING });
        const res = await model.generateContent("Say 'Verified'");
        console.log(`✅ Reasoning Success. Response: ${res.response.text()}`);
    } catch (e: any) {
        console.error(`❌ Reasoning Failed: ${e.message}`);
    }
}

verify();
