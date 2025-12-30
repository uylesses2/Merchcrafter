// import { pipeline } from '@xenova/transformers'; // Lazy load
import { localStore } from './LocalStore';
import type { ProgressCallback } from './PdfProcessor';

export class AudioProcessor {
    async process(file: File, projectId: string, onProgress?: ProgressCallback): Promise<void> {
        // Load model (first time this will download weights)
        if (onProgress) onProgress(0, 100, 'Loading Transcription Model...');

        // Dynamic import strictly here
        const { pipeline } = await import('@xenova/transformers');

        const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');

        if (onProgress) onProgress(10, 100, 'Transcribing Audio (this may take a while)...');

        // Read audio
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext(); // Must be on main thread usually, or use OfflineAudioContext
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Convert to compatible format if needed, but pipeline handles typical inputs.
        // Actually transformers.js usually expects a float32 array or URL.
        // We can pass the audioBuffer.getChannelData(0).

        // Since we are likely in a worker or main thread, lets use what we have.
        // NOTE: decodeAudioData requires user interaction context sometimes? No, typically fine.
        // But running deep learning on main thread might freeze UI. 
        // Ideally this runs in a worker. For this "Skeleton" implementation I'll put it here, 
        // but note that 'pipeline' can be heavy.

        // Chunking might be needed for long audio. Whisper usually handles 30s chunks.
        // Transformers.js handles this internally usually with 'chunk_length_s'.

        // @ts-ignore
        const output = await transcriber(audioBuffer.getChannelData(0), {
            chunk_length_s: 30,
            stride_length_s: 5
        });

        // @ts-ignore
        const fullText = output.text;

        if (onProgress) onProgress(80, 100, 'Formatting Text...');

        // Paginate Text (approx 1500 chars per page)
        const charsPerPage = 1500;
        const totalPages = Math.ceil(fullText.length / charsPerPage);

        await localStore.saveProject({
            projectId,
            sourceType: 'MP3',
            originalFilename: file.name,
            pageCount: totalPages,
            duration: audioBuffer.duration,
            createdAt: Date.now()
        });

        for (let i = 0; i < totalPages; i++) {
            const start = i * charsPerPage;
            const end = start + charsPerPage;
            const pageText = fullText.substring(start, end);

            // Render text to Image
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            // Draw white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 600, 800);

            // Draw Text
            ctx.fillStyle = 'black';
            ctx.font = '16px serif';
            ctx.textBaseline = 'top';

            // Simple text wrap
            const words = pageText.split(' ');
            let line = '';
            let y = 40;
            const lineHeight = 24;
            const maxWidth = 520;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    ctx.fillText(line, 40, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, 40, y);

            // Save Blob
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error('Canvas blob failed'));
                }, 'image/jpeg', 0.85);
            });

            await localStore.savePage({
                projectId,
                pageIndex: i,
                imageBlob: blob,
                text: pageText
            });

            if (onProgress) onProgress(80 + Math.floor((i / totalPages) * 20), 100, `Saving page ${i + 1}`);
        }
    }
}

export const audioProcessor = new AudioProcessor();
