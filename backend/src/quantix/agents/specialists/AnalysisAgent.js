/**
 * @file AnalysisAgent.js
 * @description Dedicated Analysis Specialist Agent with Live Token Streaming & Auto-Correction.
 */
import { CodeExecutorService } from '../../../services/codeExecutorService.js';
import logger from '../../../utils/logger.js';

export class AnalysisAgent {
    constructor({ client, modelName = 'gpt-4o', logger: appLogger = logger }) {
        if (!client) {
            throw new Error('[AnalysisAgent] Requires a valid LLM client.');
        }
        this.name = 'AnalysisAgent';
        this.client = client;
        this.modelName = modelName;
        this.logger = appLogger;
        this.codeExecutor = new CodeExecutorService();
        this.capabilities = ['analysis', 'calculus', 'limits', 'integrals', 'differential_equations', 'inequalities', 'sympy_calculus_tools'];
    }

    async think(task, context = {}, stream = () => {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[AnalysisAgent] Processing calculus/analysis task: "${promptText.slice(0, 80)}..."`);

        const calculusScript = await this._generateCalculusScript(promptText, stream);

        let toolResult = { output: 'Tool execution skipped.', success: true };
        if (calculusScript) {
            this.logger.info('[AnalysisAgent] 📈 Executing SymPy Calculus tool script...');
            toolResult = await this.codeExecutor.executeSymbolicMath(calculusScript, ['sympy', 'scipy', 'numpy']);
            this.logger.info(`[AnalysisAgent] Tool Output:\n${toolResult.output?.slice(0, 200)}`);
        }

        const proofResult = await this._generateAnalysisProof(promptText, toolResult.output, stream);

        return {
            agent: this.name,
            domain: 'Analysis',
            script: calculusScript,
            toolOutput: toolResult.output,
            content: proofResult.proofText,
            proofSteps: proofResult.steps || [proofResult.proofText],
            leanCode: proofResult.leanCode || ''
        };
    }

    async _generateCalculusScript(prompt, stream) {
        const sysPrompt = `
You are the SymPy Calculus Tool Generator for AnalysisAgent in NeuroSyn-Math.
Write a standalone Python script using \`sympy\` (\`limit\`, \`diff\`, \`integrate\`, \`dsolve\`, \`series\`)
or numeric optimization to compute exact limits, antiderivatives, or test inequality bounds (e.g., AM-GM, Cauchy-Schwarz).

Output ONLY valid Python code block inside \`\`\`python ... \`\`\` fences.
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
                stream: true
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

    async _generateAnalysisProof(prompt, toolOutput, stream) {
        const sysPrompt = `
You are the NeuroSyn Analysis Specialist Agent.
Provide an epsilon-delta or symbolic analysis proof and Lean 4 tactic block.
Use the output from the SymPy calculation as verified ground truth.

Respond strictly in JSON:
{
  "proofText": "Full step-by-step analytical proof...",
  "steps": ["Step 1...", "Step 2..."],
  "leanCode": "theorem analysis_target : ... := by ..."
}
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"\nSymPy Output:\n${toolOutput}` }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1,
                max_tokens: 1500, // ⚡ Cap tokens to prevent loops
                stream: true
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
            return { proofText: 'Analysis proof fallback.', steps: [prompt], leanCode: '' };
        }
    }
}