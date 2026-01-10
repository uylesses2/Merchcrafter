import { execSync } from 'child_process';

/**
 * Attempts to clear the specified port by killing any process currently listening on it.
 * This is particularly useful in development environments where a previous instance
 * might not have shut down cleanly.
 */
export async function ensurePortIsClear(port: number): Promise<void> {
    try {
        const isWindows = process.platform === 'win32';

        if (isWindows) {
            // Find PID on Windows using netstat
            const output = execSync(`netstat -ano | findstr :${port}`).toString();
            const lines = output.split('\n').filter(line => line.includes('LISTENING'));

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0' && pid !== process.pid.toString()) {
                    console.log(`[PORT] Found zombie process ${pid} on port ${port}. Killing...`);
                    try {
                        execSync(`taskkill /F /PID ${pid}`);
                        console.log(`[PORT] Successfully killed process ${pid}.`);
                    } catch (killErr) {
                        console.error(`[PORT ERROR] Failed to kill process ${pid}:`, killErr);
                    }
                }
            }
        } else {
            // Find PID on Unix-like systems using lsof
            try {
                const pid = execSync(`lsof -t -i:${port}`).toString().trim();
                if (pid && pid !== process.pid.toString()) {
                    console.log(`[PORT] Found zombie process ${pid} on port ${port}. Killing...`);
                    execSync(`kill -9 ${pid}`);
                    console.log(`[PORT] Successfully killed process ${pid}.`);
                }
            } catch (e) {
                // lsof returns exit code 1 if no process found, which is fine
            }
        }

        // Give OS a moment to release the port
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
        // If no process is found on the port, netstat/findstr might throw an error.
        // We can safely ignore this as it means the port is likely clear.
    }
}
