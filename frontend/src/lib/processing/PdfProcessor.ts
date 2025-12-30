import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';
import { localStore } from './LocalStore';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ProgressCallback {
    (current: number, total: number, message: string): void;
}

export class PdfProcessor {
    async process(file: File, projectId: string, onProgress?: ProgressCallback): Promise<void> {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;

        // Save Project Metadata
        await localStore.saveProject({
            projectId,
            sourceType: 'PDF',
            originalFilename: file.name,
            pageCount: totalPages,
            createdAt: Date.now()
        });

        for (let i = 1; i <= totalPages; i++) {
            if (onProgress) onProgress(i, totalPages, `Rendering page ${i} of ${totalPages}`);

            const page = await pdf.getPage(i);

            // Render to high-res canvas (2.0 scale for better OCR/viewing)
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) throw new Error('Failed to create canvas context');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Extract Text
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');

            // Convert canvas to blob
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error('Canvas to Blob failed'));
                }, 'image/jpeg', 0.85);
            });

            // Save Page
            await localStore.savePage({
                projectId,
                pageIndex: i, // 1-based index from PDF, we can keep it 1-based or 0-based. Let's stick to 1-based for PDF consistency? Or 0?
                // Actually typical array access is 0-based. Let's use 0-based for internal storage to match array indices.
                // But PDF pages are 1-based.
                // Let's store as Index = i - 1
                imageBlob: blob,
                text: text
            });
        }
    }
}

export const pdfProcessor = new PdfProcessor();
