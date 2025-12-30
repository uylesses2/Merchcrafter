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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 4));
    process.exit(1);
}

export const config = parsed.data;
