import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string(),
    JWT_SECRET: z.string().min(10),
    GEMINI_API_KEY: z.string().optional(),
    STRIPE_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('noreply@merchcrafter.com'),
    QDRANT_URL: z.string().default('http://127.0.0.1:6333'),
    QDRANT_API_KEY: z.string().optional(),
});


// Enforced Model Constants
export const MODEL_EMBEDDING = 'text-embedding-004';
export const MODEL_REASONING = 'gemini-3-pro-preview';

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 4));
    process.exit(1);
}

export const config = {
    ...parsed.data,
    // Strict enforcement: Mock mode only if explicitly enabled via envision variable (not currently in schema, so failing safe to false)
    MOCK_MODE: process.env.MOCK_MODE === 'true'
};

