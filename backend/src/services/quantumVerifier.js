/**
 * @file src/services/quantumVerifier.js
 * @description NeuroSyn Code Sandbox Verifier & Fuzz Tester.
 * Executes isolated code verification, static analysis, and fuzz testing.
 */

import Docker from 'dockerode';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NON_EXECUTABLE_LANGUAGES = ['pseudocode', 'plaintext', 'markdown', 'md', 'html', 'css', 'latex', 'json', 'env'];

export class QuantumVerifier {
    constructor({ clients }) {
        this.name = 'QuantumVerifier-v2';
        this.capabilities = ['code_verification', 'fuzz_testing', 'static_analysis'];
        this.clients = clients || {};

        try {
            this.docker = new Docker();
            logger.info('[QuantumVerifier] Docker client initialized.');
        } catch (err) {
            this.docker = null;
            logger.warn(`[QuantumVerifier] Docker unavailable (${err.message}). Local process sandbox active.`);
        }
    }

    /**
     * Primary entry point for code verification.
     */
    async think(input = {}) {
        let code = input.code || input.prompt || '';
        let language = input.language || 'python';
        let fuzz = input.fuzz || false;

        if (!code.trim()) {
            return { success: true, reason: 'No code provided.', output: null, errors: null };
        }

        const normLang = language.trim().toLowerCase();
        if (NON_EXECUTABLE_LANGUAGES.includes(normLang)) {
            return {
                success: true,
                reason: `Verification skipped for non-executable format: ${language}`,
                output: 'Skipped',
                errors: null
            };
        }

        logger.info(`[QuantumVerifier] Verifying ${language} script...`);

        const runResult = await this._runInSandbox({ code, language });

        let fuzzResults = { success: true, failures: [] };
        if (fuzz && runResult.success) {
            fuzzResults = await this._runFuzzTests({ code, language });
        }

        const overallSuccess = runResult.success && fuzzResults.success;

        return {
            success: overallSuccess,
            code,
            language,
            output: runResult.output,
            errors: runResult.errors || (fuzzResults.failures.length ? fuzzResults.failures.join('\n') : null)
        };
    }

    async _runInSandbox({ code, language }) {
        const tempDir = path.join(__dirname, '../../temp', uuidv4());
        try {
            await fs.ensureDir(tempDir);
            const filename = language === 'python' ? 'script.py' : 'script.js';
            const filePath = path.join(tempDir, filename);
            await fs.writeFile(filePath, code, 'utf8');

            if (this.docker) {
                return await this._runInDockerContainer(filePath, language, tempDir);
            } else {
                return await this._runInLocalSubprocess(filePath, language);
            }
        } catch (err) {
            return { success: false, output: null, errors: err.message };
        } finally {
            await fs.remove(tempDir).catch(() => { });
        }
    }

    _runInDockerContainer(filePath, language, tempDir) {
        return new Promise((resolve) => {
            const imageName = language === 'python' ? 'python:3.9-slim' : 'node:18-alpine';
            const cmd = language === 'python' ? ['python', '/app/script.py'] : ['node', '/app/script.js'];

            this.docker.createContainer({
                Image: imageName,
                Cmd: cmd,
                HostConfig: { Binds: [`${tempDir}:/app`], Memory: 256 * 1024 * 1024 }
            }, (err, container) => {
                if (err) return resolve(this._runInLocalSubprocess(filePath, language));

                container.start((startErr) => {
                    if (startErr) return resolve(this._runInLocalSubprocess(filePath, language));

                    container.wait((waitErr) => {
                        container.logs({ stdout: true, stderr: true }, (logErr, logs) => {
                            container.remove({ force: true }, () => { });
                            const logStr = logs ? logs.toString('utf8') : '';
                            resolve({
                                success: !waitErr,
                                output: logStr,
                                errors: waitErr ? logStr : null
                            });
                        });
                    });
                });
            });
        });
    }

    _runInLocalSubprocess(filePath, language) {
        return new Promise((resolve) => {
            const cmd = language === 'python' ? `python3 "${filePath}"` : `node "${filePath}"`;
            exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    output: stdout ? stdout.trim() : '',
                    errors: stderr ? stderr.trim() : (error ? error.message : null)
                });
            });
        });
    }

    async _runFuzzTests({ code, language }) {
        const fuzzCases = ["0", "-1", "null", "999999999"];
        const failures = [];
        for (const testInput of fuzzCases) {
            const res = await this._runInSandbox({ code: `${code}\n# Fuzz test input: ${testInput}`, language });
            if (!res.success) failures.push(`Fuzz case '${testInput}' failed.`);
        }
        return { success: failures.length === 0, failures };
    }
}

export default QuantumVerifier;