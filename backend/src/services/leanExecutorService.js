/**
 * @file src/services/leanExecutorService.js
 */
import { exec } from 'child_process';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import logger from '../utils/logger.js';

export class LeanExecutorService {
    constructor(options = {}) {
        this.dockerImage = process.env.LEAN_DOCKER_IMAGE || 'lean-verifier:latest';
        this.timeoutMs = options.timeoutMs || 20000;
        this.logger = options.logger || logger;
    }

    async verifyLean4(leanCode) {
        return this._executeInSandbox(leanCode);
    }

    async verify(leanCode) {
        return this.verifyLean4(leanCode);
    }

    async _executeInSandbox(rawLeanCode) {
        const leanCode = this._prepareLeanCode(rawLeanCode);
        let tempDir = null;

        // ⚡ ANTI-CHEAT Check
        if (/\bsorry\b|\badmit\b/.test(leanCode)) {
            this.logger.info(`[LeanExecutorService] Anti-Cheat active: AI attempted to bypass formal proof.`);
            return {
                success: false,
                verified: false,
                isAntiCheatTriggered: true, // Flag for Orchestrator short-circuit
                output: '',
                error: "CRITICAL REJECTION: Lean code contains 'sorry' or 'admit'. Complete proof required.",
                errorDetails: { hasError: true, message: "Use of 'sorry' or 'admit' is strictly forbidden." }
            };
        }

        try {
            tempDir = await mkdtemp(path.join(os.tmpdir(), 'neurosyn-lean-'));
            const filePath = path.join(tempDir, 'Proof.lean');
            await writeFile(filePath, leanCode, 'utf8');

            const command = `docker run --rm -v "${tempDir}:/proof_sandbox" ${this.dockerImage} lean /proof_sandbox/Proof.lean`;

            const result = await this._execWithTimeout(command, this.timeoutMs);
            const parsedError = this._parseLeanError(result.stderr || result.stdout);

            if (result.error || parsedError.hasError) {
                return {
                    success: false,
                    verified: false,
                    isAntiCheatTriggered: false,
                    output: result.stdout,
                    error: parsedError.message || result.stderr,
                    errorDetails: parsedError
                };
            }

            return {
                success: true,
                verified: true,
                isAntiCheatTriggered: false,
                output: result.stdout,
                error: null
            };

        } catch (err) {
            this.logger.error(`[LeanExecutorService] Verification execution error: ${err.message}`);
            return {
                success: false,
                verified: false,
                isAntiCheatTriggered: false,
                output: '',
                error: err.message,
                errorDetails: { hasError: true, message: err.message, line: null }
            };
        } finally {
            if (tempDir) {
                await rm(tempDir, { recursive: true, force: true }).catch(() => { });
            }
        }
    }

    _prepareLeanCode(code) {
        if (!code) return 'import Mathlib\n\ntheorem empty_proof : True := by trivial';
        let prepared = code.trim();
        if (!prepared.includes('import Mathlib') && !prepared.includes('import Mathlib.')) {
            prepared = `import Mathlib\n\n${prepared}`;
        }
        return prepared;
    }

    _execWithTimeout(command, timeout) {
        return new Promise((resolve) => {
            exec(command, { timeout }, (error, stdout, stderr) => {
                resolve({ error, stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' });
            });
        });
    }

    _parseLeanError(output) {
        if (!output) return { hasError: false, message: null };
        const hasError = output.includes('error:') || output.includes('unsolved goals') || output.includes('type mismatch');
        const lineMatch = output.match(/Proof\.lean:(\d+):(\d+): error: (.*)/s);

        if (lineMatch) {
            return {
                hasError: true,
                line: parseInt(lineMatch[1], 10),
                column: parseInt(lineMatch[2], 10),
                message: lineMatch[3].trim()
            };
        }

        return { hasError, line: null, column: null, message: output.trim() };
    }
}

export const leanExecutor = new LeanExecutorService();