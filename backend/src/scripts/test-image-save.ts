
import { saveBase64Image } from '../services/imageUtils';
import path from 'path';

async function main() {
    console.log("Testing saveBase64Image...");
    const base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    try {
        const url = await saveBase64Image(base64, 'png');
        console.log(`Success! Image saved at: ${url}`);

        // Check if file exists
        const fs = require('fs');
        const publicDir = path.join(__dirname, '../../public');
        const filePath = path.join(publicDir, url); // url starts with /generated/
        // remove leading / from url if publicDir doesn't include it? 
        // url is like /generated/abc.png. publicDir is backend/public.
        // path.join(backend/public, /generated/abc.png) might be weird on windows.
        // Let's just check relative.

        console.log(`Checking path: ${publicDir} + ${url}`);

    } catch (err) {
        console.error("Failed:", err);
        process.exit(1);
    }
}

main();
