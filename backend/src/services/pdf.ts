import { promises as fs } from 'fs';
const pdf = require('pdf-parse');

export async function extractTextFromPdf(filePath: string): Promise<{ text: string; pageCount: number }> {
    const dataBuffer = await fs.readFile(filePath);

    // Handle the standard pdf-parse (v1.1.1) call pattern
    const data = await pdf(dataBuffer);

    return {
        text: data.text,
        pageCount: data.numpages
    };
}

export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        const endIndex = Math.min(startIndex + chunkSize, text.length);
        const chunk = text.slice(startIndex, endIndex);
        chunks.push(chunk);

        startIndex += chunkSize - overlap;
    }

    return chunks;
}
