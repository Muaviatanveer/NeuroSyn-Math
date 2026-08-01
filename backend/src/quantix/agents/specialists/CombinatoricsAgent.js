/**
 * @file CombinatoricsAgent.js
 * @description Dedicated Combinatorics Specialist Agent for NeuroSyn-Math.
 * Handles Counting, Permutations, Invariants, Pigeonhole Principle, and Generating Functions.
 * Uses Python brute-force scans and SymPy generating series tools to test small-n cases.
 */

import { CodeExecutorService } from '../../../services/codeExecutorService.js';
import logger from '../../../utils/logger.js';

export class CombinatoricsAgent {
    constructor({ client, modelName = 'gpt-4o', logger: appLogger = logger }) {
        if (!client) {
            throw new Error('[CombinatoricsAgent] Requires a valid LLM client.');
        }
        this.name = 'CombinatoricsAgent';
        this.client = client;
        this.modelName = modelName;
        this.logger = appLogger;
        this.codeExecutor = new CodeExecutorService();
        this.capabilities = ['combinatorics', 'counting', 'invariants', 'generating_functions', 'pigeonhole', 'python_simulation'];
    }

    /**
     * Executes combinatorial reasoning with small-n Python simulation tools.
     */
    async think(task, context = {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[CombinatoricsAgent] Processing combinatorics task: "${promptText.slice(0, 80)}..."`);

        // Step 1: Generate Small-N Brute Force or Series Expansion Tool Script
        const simScript = await this._generateCombinatoricsScript(promptText);

        // Step 2: Run Python Brute Force / Generating Function Simulation
        let toolResult = { output: 'Tool execution skipped.', success: true };
        if (simScript) {
            this.logger.info('[CombinatoricsAgent] 🎲 Executing Python combinatorial simulation script...');
            toolResult = await this.codeExecutor.executeSymbolicMath(simScript, ['sympy', 'scipy', 'numpy']);
            this.logger.info(`[CombinatoricsAgent] Tool Output:\n${toolResult.output?.slice(0, 200)}`);
        }

        // Step 3: Deduce General Formula & Build Formal Proof
        const proofResult = await this._generateCombinatoricsProof(promptText, toolResult.output);

        return {
            agent: this.name,
            domain: 'Combinatorics',
            script: simScript,
            toolOutput: toolResult.output,
            content: proofResult.proofText,
            proofSteps: proofResult.steps || [proofResult.proofText],
            leanCode: proofResult.leanCode || ''
        };
    }

    async _generateCombinatoricsScript(prompt) {
        const sysPrompt = `
You are the Combinatorial Simulation Generator for CombinatoricsAgent in NeuroSyn-Math.
Write a Python script using \`itertools\`, \`math.comb\`, or \`sympy.series\` to brute-force evaluate small values of n (e.g. n=1..10) or compute generating functions.

Output ONLY valid Python code block inside \`\`\`python ... \`\`\` fences.
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"` }
                ],
                temperature: 0.0
            });

            const raw = res.choices[0].message.content;
            const match = raw.match(/```python\s*([\s\S]*?)\s*```/) || [null, raw];
            return match[1].trim();
        } catch (e) {
            return null;
        }
    }

    async _generateCombinatoricsProof(prompt, toolOutput) {
        const sysPrompt = `
You are the NeuroSyn Combinatorics Specialist Agent.
Provide a rigorous combinatorial proof (Induction, Invariant, or Double Counting) and a Lean 4 block.
Use the small-n empirical sequence data calculated by the tool as proof ground truth.

Respond strictly in JSON:
{
  "proofText": "Full step-by-step combinatorial proof...",
  "steps": ["Step 1...", "Step 2..."],
  "leanCode": "theorem combinatorics_target : ... := by ..."
}
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"\nSmall-N Tool Results:\n${toolOutput}` }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1
            });

            return JSON.parse(res.choices[0].message.content);
        } catch (e) {
            return { proofText: 'Combinatorial proof fallback.', steps: [prompt], leanCode: '' };
        }
    }
}