import ePub from 'epubjs';
import html2canvas from 'html2canvas';
import { localStore } from './LocalStore';
import type { ProgressCallback } from './PdfProcessor';

export class EpubProcessor {
    async process(file: File, projectId: string, onProgress?: ProgressCallback): Promise<void> {
        const reader = new FileReader();
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });

        const book = ePub(arrayBuffer);
        await book.ready;

        // Save metadata
        // @ts-ignore - epubjs types can be tricky
        const metadata = book.package.metadata;
        await localStore.saveProject({
            projectId,
            sourceType: 'EPUB',
            originalFilename: file.name,
            pageCount: 0, // Will update later
            createdAt: Date.now()
        });

        // Create offscreen container
        const container = document.createElement('div');
        container.style.width = '600px';
        container.style.height = '800px';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.background = 'white';
        document.body.appendChild(container);

        const rendition = book.renderTo(container, {
            width: 600,
            height: 800,
            flow: "paginated"
        });

        await rendition.display();

        // Generate locations to know total pages
        if (onProgress) onProgress(0, 100, 'Generating locations (this may take a while)...');
        await book.locations.generate(1000);
        const locations = book.locations.total;

        let pageIndex = 0;
        const totalLocations = book.locations.length(); // approximate pages

        // Iterate through all "pages" (locations)
        // Note: iteranting by cfi can be slow. A simpler approach for "pages" is just stepping next()
        // But we need to ensure we capture everything.
        // Let's rely on the location list.

        let currentCfi = book.locations.cfiFromPercentage(0);

        // This loop is a simplification. robust epub pagination is hard.
        // We will try to just `next()` until we run out.

        // Reset to start
        await rendition.display(currentCfi);

        let hasNext = true;
        while (hasNext) {
            if (onProgress) onProgress(pageIndex, totalLocations, `Rendering page ${pageIndex + 1}`);

            // Wait for render
            await new Promise(r => setTimeout(r, 100)); // slight delay for layout

            // Snapshot
            // Use html2canvas
            const canvas = await html2canvas(container, { scale: 1.5 });

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error('Canvas blob failed'));
                }, 'image/jpeg', 0.85);
            });

            // Extract text from current view
            const text = container.innerText;

            await localStore.savePage({
                projectId,
                pageIndex,
                imageBlob: blob,
                text
            });

            pageIndex++;

            // Go next
            // @ts-ignore
            const nextSection = await rendition.next();
            if (!nextSection) {
                hasNext = false;
            }
        }

        // Update total pages
        const project = await localStore.getProject(projectId);
        if (project) {
            project.pageCount = pageIndex;
            await localStore.saveProject(project);
        }

        // Cleanup
        document.body.removeChild(container);
    }
}

export const epubProcessor = new EpubProcessor();
