
import { spawn } from 'child_process';
import path from 'path';

export async function calculatePythonIndicators(data: any[]) {
    const pythonPath = process.env.PYTHON_PATH || 'python'; // El usuario puede configurar esto en .env
    const scriptPath = path.join(process.cwd(), 'python', 'indicators_algo.py');

    return new Promise((resolve, reject) => {
        const pyProcess = spawn(pythonPath, [scriptPath]);
        let output = '';
        let errorOutput = '';

        pyProcess.stdin.write(JSON.stringify(data));
        pyProcess.stdin.end();

        pyProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pyProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pyProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`[PythonBridge] Error code ${code}: ${errorOutput}`);
                reject(new Error(errorOutput || `Python process exited with code ${code}`));
                return;
            }
            try {
                const result = JSON.parse(output);
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result);
                }
            } catch (e) {
                reject(new Error('Failed to parse Python output as JSON'));
            }
        });
    });
}
