/**
 * @file src/quantix/solvers/gptSolver.js
 * @description OpenAI GPT Mathematical Solver for NeuroSyn-Math.
 * Generates natural language proof steps, SymPy scripts, and Lean 4 formal tactic blocks.
 */

import ProofObject from '../proofFormats/proofObject.js';
import logger from '../../utils/logger.js';

class SolverError extends Error {
    constructor(message, options = {}) {
        super(message, { cause: options.cause });
        this.name = 'SolverError';
        this.details = options.details;
    }
}

const SLEEP = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class GptSolver {
    constructor({
        client,
        modelName = 'gpt-4o',
        maxRetries = 2,
        timeoutMs = 60000,
        logger: appLogger = logger
    }) {
        if (!client || !modelName) {
            throw new Error('[GptSolver] Requires client and modelName.');
        }
        this.client = client;
        this.modelName = modelName;
        this.maxRetries = maxRetries;
        this.timeoutMs = timeoutMs;
        this.logger = appLogger;
    }

    /**
     * Solves a mathematical problem and returns a complete ProofObject.
     */
    async solve(problem, solverName = 'GPT4o-Math', attempt = 1, feedback = null) {
        const prompt = this._buildPrompt(problem, attempt, feedback);
        let retryAttempt = 0;

        while (retryAttempt <= this.maxRetries) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort('timeout'), this.timeoutMs);

            try {
                this.logger.info(`[GptSolver] Attempt ${retryAttempt + 1}/${this.maxRetries + 1} using model "${this.modelName}"`);

                const response = await this.client.chat.completions.create({
                    model: this.modelName,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0.1
                }, {
                    timeout: this.timeoutMs,
                    signal: controller.signal
                });

                clearTimeout(timeout);

                const rawOutput = response?.choices?.[0]?.message?.content;
                if (!rawOutput) throw new Error('Empty response from model.');

                const parsed = JSON.parse(rawOutput.replace(/```json|```/g, '').trim());

                return new ProofObject({
                    problem,
                    solver: solverName,
                    attempt,
                    finalAnswer: parsed.finalAnswer,
                    solutionCode: parsed.solutionCode || '',
                    leanCode: parsed.leanCode || '',
                    reasoningSummary: parsed.reasoningSummary,
                    steps: parsed.steps || [],
                    domain: parsed.domain || 'Algebra'
                });

            } catch (err) {
                clearTimeout(timeout);
                const isTimeout = err?.message === 'timeout';
                const status = err?.status || err?.response?.status;
                const isRetryable = isTimeout || status === 429 || (typeof status === 'number' && status >= 500 && status <= 599);

                if (isRetryable && retryAttempt < this.maxRetries) {
                    const backoff = Math.min(1000 * 2 ** retryAttempt, 8000);
                    this.logger.warn(`[GptSolver] Retryable error (${status || 'timeout'}). Retrying in ${backoff}ms...`);
                    retryAttempt++;
                    await SLEEP(backoff);
                    continue;
                }

                this.logger.error(`[GptSolver] Permanent failure: ${err.message}`);
                throw new SolverError(`GptSolver failed: ${err.message}`, { cause: err });
            }
        }

        throw new SolverError('GptSolver exhausted all retries.');
    }

    _buildPrompt(problem, attempt, feedback) {
        const feedbackBlock = feedback ? `\n\nREVISION FEEDBACK:\n"${feedback}"\n` : '';

        return `
You are the NeuroSyn GPT Mathematical Solver.
Solve this problem with step-by-step mathematical reasoning, a python SymPy validation script, and formal Lean 4 tactics.

Problem: "${problem}"
Attempt: ${attempt}
${feedbackBlock}

Respond strictly in JSON with this schema:
{
  "domain": "Algebra",
  "finalAnswer": "Derived result or proof summary",
  "reasoningSummary": "Natural language step-by-step mathematical reasoning",
  "steps": [
    { "step": 1, "rule": "ASSUMPTION", "statement": "Premise definition", "justification": "Given" }
  ],
  "solutionCode": "import sympy as sp\\n# Python validation script",
  "leanCode": "import Mathlib\\n\\ntheorem math_problem : True := by trivial"
}
`;
    }
}