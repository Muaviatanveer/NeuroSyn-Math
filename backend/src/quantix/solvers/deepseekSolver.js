/**
 * @file src/quantix/solvers/deepseekSolver.js
 * @description DeepSeek / Open-Source Reasoning Solver for NeuroSyn-Math.
 * Handles local Ollama models (deepseek-r1:32b, qwq:32b) with <think> tag cleaning.
 */

import ProofObject from '../proofFormats/proofObject.js';
import logger from '../../utils/logger.js';
import { getModelForRole } from '../../config/clients.js';

class SolverError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'SolverError';
    this.details = options.details;
  }
}

const SLEEP = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DeepseekSolver {
  constructor({
    client,
    modelName,
    maxRetries = 2,
    timeoutMs = 120000, // Increased timeout for deep local R1 reasoning
    logger: appLogger = logger
  } = {}) {
    if (!client) {
      throw new Error('[NeuroSyn-Math] DeepseekSolver requires a valid client instance.');
    }
    this.client = client;
    this.modelName = modelName || getModelForRole('math_reasoning');
    this.maxRetries = maxRetries;
    this.timeoutMs = timeoutMs;
    this.logger = appLogger;
  }

  async solve(problem, solverName = 'DeepSeek-Math', attempt = 1, feedback = null) {
    const prompt = this._buildMathPrompt(problem, attempt, feedback);
    let retryAttempt = 0;

    while (retryAttempt <= this.maxRetries) {
      try {
        this.logger.info(`[DeepSeek Solver] Querying model "${this.modelName}" (Attempt ${retryAttempt + 1})...`);

        const response = await this.client.chat.completions.create({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        });

        const rawOutput = response?.choices?.[0]?.message?.content;
        if (!rawOutput) throw new Error('Empty response from open-source model.');

        // ⚡ Clean <think> tags from DeepSeek-R1 / QwQ chain-of-thought outputs
        const cleanedOutput = this._cleanReasoningTags(rawOutput);
        const parsed = this._parseResponse(cleanedOutput);

        return new ProofObject({
          problem,
          solver: solverName,
          attempt,
          finalAnswer: parsed.finalAnswer || problem,
          solutionCode: parsed.solutionCode || '',
          leanCode: parsed.leanCode || '',
          reasoningSummary: parsed.reasoningSummary || cleanedOutput.slice(0, 500),
          steps: parsed.steps || [],
          domain: parsed.domain || 'Algebra'
        });

      } catch (err) {
        if (retryAttempt < this.maxRetries) {
          retryAttempt++;
          this.logger.warn(`[DeepSeek Solver] Retrying open-source solver (${retryAttempt}/${this.maxRetries}): ${err.message}`);
          await SLEEP(2000);
          continue;
        }

        this.logger.error(`[DeepSeek Solver] Permanent failure on model ${this.modelName}: ${err.message}`);
        throw new SolverError(`Solver failed on model ${this.modelName}`, { cause: err });
      }
    }
  }

  /**
   * Strips <think>...</think> tags emitted by DeepSeek-R1 and QwQ models.
   */
  _cleanReasoningTags(rawText) {
    if (!rawText) return '';
    // Remove thoughts enclosed in <think> ... </think>
    let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Remove markdown code fences if wrapped
    cleaned = cleaned.replace(/```json|```/g, '').trim();
    return cleaned;
  }

  _parseResponse(raw) {
    try {
      const startIndex = raw.indexOf('{');
      const endIndex = raw.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonSubstring = raw.substring(startIndex, endIndex + 1);
        return JSON.parse(jsonSubstring);
      }
      return JSON.parse(raw);
    } catch (err) {
      this.logger.warn(`[DeepSeek Solver] Raw response was not structured JSON. Converting raw output.`);
      return {
        finalAnswer: raw,
        reasoningSummary: raw,
        steps: [raw]
      };
    }
  }

  _buildMathPrompt(problem, attempt, feedback) {
    const feedbackText = feedback ? `\nREVISION FEEDBACK:\n"${feedback}"\n` : '';

    return `
You are the NeuroSyn Mathematical Proof Engine.
Solve this problem with step-by-step rigour, a python SymPy script, and formal Lean 4 tactics.

Problem: "${problem}"
Attempt: ${attempt}
${feedbackText}

CRITICAL LEAN 4 RULES:
1. You MUST use LEAN 4 syntax, NOT Lean 3.
2. DO NOT use 'begin ... end'. Use 'by ...'.
3. DO NOT use 'open_locale'.
4. DO NOT use the 'sorry' keyword. You must provide a complete proof.

Respond ONLY with a valid JSON object matching this schema:
{
  "domain": "Algebra",
  "finalAnswer": "Derived result or proof conclusion",
  "reasoningSummary": "Natural language mathematical proof steps",
  "steps": [
    { "step": 1, "rule": "ASSUMPTION", "statement": "Premise definition", "justification": "Given" }
  ],
  "solutionCode": "import sympy as sp\\n# Runnable python script",
  "leanCode": "import Mathlib\\n\\ntheorem math_problem : True := by trivial"
}
`;
  }
}