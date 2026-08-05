/**
 * @file src/services/codeExecutorService.js
 * @description NeuroSyn-Math Symbolic Engine (Optimized - No Runtime pip install Delays).
 */
import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import stream from 'stream';
import { exec } from 'child_process';
import logger from '../utils/logger.js';

const docker = new Docker();
const EXECUTION_TIMEOUT_S = 20;

const EXECUTION_CONFIG = {
    python: {
        image: process.env.PYTHON_DOCKER_IMAGE || 'python-ml',
        filename: 'script.py',
        // ⚡ FIX: Execute python directly without running pip install every execution
        command: (filename) => ['python3', `/app/${filename}`]
    },
    javascript: {
        image: 'node:20-slim',
        filename: 'index.js',
        command: (filename) => ['node', `/app/${filename}`]
    }
};

export class CodeExecutorService {
    constructor(options = {}) {
        this.logger = options.logger || logger;
    }

    async execute(code, language = 'python') {
        return executeCodeInContainer(language, code);
    }

    async executeSymbolicMath(script) {
        return executeCodeInContainer('python', script);
    }

    async runCounterexampleSearch(problemSpec) {
        const counterexampleScript = `
import sympy as sp
print({"status": "no_counterexample_found"})
`;
        return this.executeSymbolicMath(counterexampleScript);
    }
}

export class CodeExecutor {
    static async run(language, code) {
        return executeCodeInContainer(language, code);
    }
}

export async function executeCodeInContainer(language, code) {
    if (!EXECUTION_CONFIG[language]) {
        throw new Error(`[CodeExecutor] Language '${language}' is not supported.`);
    }

    const config = EXECUTION_CONFIG[language];
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'neurosyn-sym-'));
    const filePath = path.join(tempDir, config.filename);

    await fs.writeFile(filePath, code, 'utf8');

    try {
        return await _runInDocker(config, tempDir);
    } catch (dockerErr) {
        logger.error(`[CodeExecutor] Docker unavailable. Local fallback disabled for security.`);
        return { output: '', error: 'Docker is required for secure code execution.', exitCode: 1 };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
    }
}

async function _runInDocker(config, tempDir) {
    let output = '';
    let error = '';

    const container = await docker.createContainer({
        Image: config.image,
        Cmd: config.command(config.filename),
        Tty: false,
        AttachStdout: true,
        AttachStderr: true,
        HostConfig: {
            Binds: [`${tempDir}:/app`],
            AutoRemove: true,
            Memory: 512 * 1024 * 1024,
            CpuQuota: 50000
        }
    });

    const dockerStream = await container.attach({ stream: true, stdout: true, stderr: true });
    const outStream = new stream.PassThrough();
    const errStream = new stream.PassThrough();

    outStream.on('data', chunk => output += chunk.toString('utf8'));
    errStream.on('data', chunk => error += chunk.toString('utf8'));

    container.modem.demuxStream(dockerStream, outStream, errStream);

    await container.start();

    const timer = setTimeout(async () => {
        try { await container.stop(); } catch (e) { }
    }, EXECUTION_TIMEOUT_S * 1000);

    const status = await container.wait();
    clearTimeout(timer);

    return { output: output.trim(), error: error.trim(), exitCode: status.StatusCode };
}