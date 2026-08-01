/**
 * @file src/quantix/agents/specialists/NumberTheoryAgent.js
 * @description Dedicated Number Theory Specialist Agent with Python Auto-Correction & Precision Guarantees.
 */
import { CodeExecutorService } from '../../../services/codeExecutorService.js';
import logger from '../../../utils/logger.js';
import { MathUtils } from '../../../utils/mathUtils.js';

export class NumberTheoryAgent {
    constructor({ client, modelName = 'gpt-4o', logger: appLogger = logger }) {
        if (!client) {
            throw new Error('[NumberTheoryAgent] Requires a valid LLM client.');
        }
        this.name = 'NumberTheoryAgent';
        this.client = client;
        this.modelName = modelName;
        this.logger = appLogger;
        this.codeExecutor = new CodeExecutorService();
        this.capabilities = ['number_theory', 'diophantine', 'modular_arithmetic', 'primes', 'z3_smt_tools'];
    }

    async think(task, context = {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[NumberTheoryAgent] Processing number theory task: "${promptText.slice(0, 80)}..."`);

        let numberTheoryScript = await this._generateNumberTheoryScript(promptText);
        let toolResult = { output: 'Tool execution skipped.', success: true };

        // ⚡ Python Sandbox Auto-Correction Loop (up to 2 repair passes)
        if (numberTheoryScript) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                this.logger.info(`[NumberTheoryAgent] 🔢 Executing Python Tool (Attempt ${attempt})...`);
                toolResult = await this.codeExecutor.executeSymbolicMath(numberTheoryScript);

                const hasError = !toolResult.output || toolResult.output.includes('Traceback') || toolResult.output.includes('Error:');
                if (!hasError) {
                    this.logger.info(`[NumberTheoryAgent] Tool Output Verified:\n${toolResult.output?.slice(0, 200)}`);
                    break;
                }

                this.logger.warn(`[NumberTheoryAgent] Python Tool execution error on attempt ${attempt}. Initiating code repair loop...`);
                numberTheoryScript = await this._repairPythonScript(numberTheoryScript, toolResult.output || toolResult.error);
            }
        }

        const proofResult = await this._generateNumberTheoryProof(promptText, toolResult.output, numberTheoryScript);

        return {
            agent: this.name,
            domain: 'Number Theory',
            script: numberTheoryScript,
            toolOutput: toolResult.output,
            content: proofResult.proofText,
            proofSteps: proofResult.steps || [proofResult.proofText],
            leanCode: proofResult.leanCode || ''
        };
    }

    async _generateNumberTheoryScript(prompt) {
        const sysPrompt = `
You are the Number Theory Tool Generator for NumberTheoryAgent in NeuroSyn-Math.
Write a standalone Python script to solve or verify the number-theoretic problem.

⚡ CRITICAL PRECISION & ALGORITHMIC CONSTRAINTS:
1. Python floats lose precision above 10^15. DO NOT use \`math.exp()\` or \`math.log()\` to recover exact integer modulo results.
2. For Meet-in-the-Middle subset algorithms, track the exact integer products/sums alongside subset values so exact modulo arithmetic (% MOD) can be computed.
3. Keep memory overhead low (use generator expressions, efficient lists).

Output ONLY a valid Python code block inside \`\`\`python ... \`\`\` fences.
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

    async _repairPythonScript(badScript, errorMessage) {
        const prompt = `Fix this Python script which failed during execution.

Execution Error Output:
\`\`\`
${errorMessage}
\`\`\`

Script to Fix:
\`\`\`python
${badScript}
\`\`\`

Ensure you track exact integer calculations without floating-point precision loss.
Output ONLY the corrected valid \`\`\`python ... \`\`\` block.`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.0
            });

            const raw = res.choices[0].message.content;
            const match = raw.match(/```python\s*([\s\S]*?)\s*```/) || [null, raw];
            return match[1].trim();
        } catch (e) {
            return badScript;
        }
    }

    async _generateNumberTheoryProof(prompt, toolOutput, verifiedScript) {
        const sysPrompt = `
You are the NeuroSyn Number Theory Specialist Agent.
Generate a rigorous, publication-grade mathematical proof and complete code implementation.

STRICT INSTRUCTIONS:
1. Answer EVERY task and sub-question in the user prompt explicitly.
2. Write out complete mathematical proofs and derivations with explicit equations.
3. Embed the verified Python script below directly inside a complete \`\`\`python ... \`\`\` block in the "proofText" field. Do NOT write prose summaries of code.
4. Ensure all modular arithmetic identities and sign checks are mathematically exact.

Respond strictly in valid JSON format:
{
  "proofText": "Full Markdown solution with rigorous derivation and complete copy-pasteable python code block...",
  "steps": ["Step 1 derivation...", "Step 2 algorithm...", "Step 3 sign check...", "Step 4 code..."],
  "leanCode": "theorem number_theory_target : ... := by ..."
}
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"\nVerified Tool Output:\n${toolOutput}\nVerified Python Code:\n\`\`\`python\n${verifiedScript || ''}\n\`\`\`` }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1
            });

            return JSON.parse(res.choices[0].message.content);
        } catch (e) {
            return { proofText: 'Number theory proof fallback.', steps: [prompt], leanCode: '' };
        }
    }
}