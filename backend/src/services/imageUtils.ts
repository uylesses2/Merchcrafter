import * as fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Saves a base64 string as an image file to the public/generated directory.
 * @param base64Data The base64 string (with or without prefix).
 * @param extension File extension (default: 'png').
 * @returns The relative URL path to the saved image (e.g., "/generated/abc.png").
 */
export async function saveBase64Image(base64Data: string, extension = 'png'): Promise<string> {
    // Ensure public/generated exists
    const publicDir = path.join(__dirname, '../../public');
    const generatedDir = path.join(publicDir, 'generated');

    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

    // Strip prefix if present (e.g., "data:image/png;base64,")
    const match = base64Data.match(/^data:image\/([a-z]+);base64,(.+)$/);
    let data = base64Data;
    let ext = extension;

    if (match) {
        ext = match[1];
        data = match[2];
    } else {
        // Simple strip if no regex match but comma exists
        if (base64Data.includes(',')) {
            data = base64Data.split(',')[1];
        }
    }

    const filename = `${randomUUID()}.${ext}`;
    const filePath = path.join(generatedDir, filename);

    await fs.promises.writeFile(filePath, data, 'base64');

    // Return URL path relative to server root (assuming serving static from /public)
    // If serving static from /public mapped to root, then /generated/...
    // If mapped to /public, then /public/generated/...
    // app.ts serves with prefix '/public/', so we need '/public/generated/...'
    return `/public/generated/${filename}`;
}
