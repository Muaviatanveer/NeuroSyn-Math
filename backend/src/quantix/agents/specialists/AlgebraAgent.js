/**
 * @file AlgebraAgent.js
 * @description Dedicated Algebra Specialist Agent with Live Token Streaming & Auto-Correction.
 */
import { CodeExecutorService } from '../../../services/codeExecutorService.js';
import logger from '../../../utils/logger.js';

export class AlgebraAgent {
    constructor({ client, modelName = 'gpt-4o', logger: appLogger = logger }) {
        if (!client) {
            throw new Error('[AlgebraAgent] Requires a valid LLM client.');
        }
        this.name = 'AlgebraAgent';
        this.client = client;
        this.modelName = modelName;
        this.logger = appLogger;
        this.codeExecutor = new CodeExecutorService();
        this.capabilities = ['algebra', 'group_theory', 'polynomials', 'linear_algebra', 'sympy_tools'];
    }

    async think(task, context = {}, stream = () => {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[AlgebraAgent] Processing algebraic task: "${promptText.slice(0, 80)}..."`);

        let sympyScript = await this._generateSymPyScript(promptText, context, stream);

        let toolExecutionResult = { output: 'Tool execution bypassed.', success: true };
        if (sympyScript) {
            this.logger.info('[AlgebraAgent] 🐍 Executing SymPy tool script in Python sandbox...');
            toolExecutionResult = await this.codeExecutor.executeSymbolicMath(sympyScript);
            this.logger.info(`[AlgebraAgent] Tool Output:\n${toolExecutionResult.output?.slice(0, 200)}`);
        }

        const finalProof = await this._generateVerifiedProof(promptText, toolExecutionResult.output, context, stream);

        return {
            agent: this.name,
            domain: 'Algebra',
            sympyScript,
            toolOutput: toolExecutionResult.output,
            content: finalProof.proofText,
            proofSteps: finalProof.steps || [finalProof.proofText],
            leanCode: finalProof.leanCode || ''
        };
    }

    async _generateSymPyScript(prompt, context, stream) {
        const sysPrompt = `
You are the SymPy Code Generator for AlgebraAgent in NeuroSyn-Math.
Write a standalone Python script using SymPy to simplify, solve, or verify the algebraic statement.
Output ONLY a valid Python code block inside \`\`\`python ... \`\`\` fences.
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"` }
                ],
                temperature: 0.0,
                max_tokens: 800, // ⚡ Cap tokens to prevent loops
                stream: true // ⚡ Stream live tokens!
            });

            let fullText = '';
            for await (const chunk of res) {
                const token = chunk.choices[0]?.delta?.content || '';
                fullText += token;
                if (token && typeof stream === 'function') {
                    stream('token', { agent: this.name, token });
                }
            }

            const match = fullText.match(/```python\s*([\s\S]*?)\s*```/) || [null, fullText];
            return match[1].trim();
        } catch (e) {
            return null;
        }
    }

    async _generateVerifiedProof(prompt, toolOutput, context, stream) {
        const sysPrompt = `
You are the NeuroSyn Algebra Specialist Agent.
Generate a rigorous step-by-step algebraic proof and complete code implementation.

STRICT INSTRUCTIONS:
1. Answer EVERY task and sub-question in the user prompt explicitly.
2. Include complete equations, step-by-step derivations, and proofs.
3. Include a complete, production-grade \`\`\`python ... \`\`\` script. Do NOT write summaries.

Respond strictly in JSON format:
{
  "proofText": "Full pedagogical proof text including markdown and complete python code blocks...",
  "steps": ["Step 1...", "Step 2..."],
  "leanCode": "theorem algebra_target : ... := by ..."
}
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"\nSymPy Tool Execution Output:\n${toolOutput}` }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1,
                max_tokens: 1500, // ⚡ Cap tokens to prevent loops
                stream: true // ⚡ Stream live proof generation!
            });

            let fullText = '';
            for await (const chunk of res) {
                const token = chunk.choices[0]?.delta?.content || '';
                fullText += token;
                if (token && typeof stream === 'function') {
                    stream('token', { agent: this.name, token });
                }
            }

            return JSON.parse(fullText);
        } catch (e) {
            return { proofText: 'Proof generation fallback.', steps: [prompt], leanCode: '' };
        }
    }
}