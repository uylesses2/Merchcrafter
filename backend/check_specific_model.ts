import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const MODEL_NAME = 'gemini-3-pro-preview';


async function checkModel() {
    console.log(`Testing generation with model: ${MODEL_NAME}`);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    try {
        const result = await model.generateContent("Hello, are you there?");
        console.log(`✅ Success! Response: ${result.response.text()}`);
    } catch (e: any) {
        console.error(`❌ Failed: ${e.message}`);
    }
}

checkModel();
