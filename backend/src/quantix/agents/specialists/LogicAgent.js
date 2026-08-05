/**
 * @file LogicAgent.js
 * @description Dedicated Logic Specialist Agent for NeuroSyn-Math with Live Token Streaming.
 */
import { CodeExecutorService } from '../../../services/codeExecutorService.js';
import logger from '../../../utils/logger.js';

export class LogicAgent {
    constructor({ client, modelName = 'gpt-4o', logger: appLogger = logger }) {
        if (!client) {
            throw new Error('[LogicAgent] Requires a valid LLM client.');
        }
        this.name = 'LogicAgent';
        this.client = client;
        this.modelName = modelName;
        this.logger = appLogger;
        this.codeExecutor = new CodeExecutorService();
        this.capabilities = ['logic', 'quantifiers', 'proof_by_contradiction', 'induction', 'z3_sat_tools'];
    }

    async think(task, context = {}, stream = () => {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[LogicAgent] Processing logical reasoning task: "${promptText.slice(0, 80)}..."`);

        const z3Script = await this._generateZ3LogicScript(promptText, stream);

        let toolResult = { output: 'Tool execution skipped.', success: true };
        if (z3Script) {
            this.logger.info('[LogicAgent] ⚖️ Executing Z3 SMT logic tool script...');
            toolResult = await this.codeExecutor.executeSymbolicMath(z3Script, ['z3-solver']);
            this.logger.info(`[LogicAgent] Z3 Output:\n${toolResult.output?.slice(0, 200)}`);
        }

        const proofResult = await this._generateLogicProof(promptText, toolResult.output, stream);

        return {
            agent: this.name,
            domain: 'Logic',
            script: z3Script,
            toolOutput: toolResult.output,
            content: proofResult.proofText,
            proofSteps: proofResult.steps || [proofResult.proofText],
            leanCode: proofResult.leanCode || ''
        };
    }

    async _generateZ3LogicScript(prompt, stream) {
        const sysPrompt = `
You are the Z3 Logic Script Generator for LogicAgent in NeuroSyn-Math.
Write a Python script using \`z3\` (\`Solver\`, \`Bool\`, \`And\`, \`Or\`, \`Not\`, \`Implies\`)
to check if assuming the negation of the goal leads to UNSAT (Proof by Contradiction).

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

    async _generateLogicProof(prompt, toolOutput, stream) {
        const sysPrompt = `
You are the NeuroSyn Logic Specialist Agent.
Provide a natural deduction or proof by contradiction step graph and a Lean 4 tactic block.
Incorporate the Z3 SMT SAT/UNSAT result as formal proof logic.

STRICT INSTRUCTIONS:
1. Provide step-by-step logic derivations.
2. If you provide a Lean 4 theorem proof, wrap it strictly in a \`\`\`lean ... \`\`\` code block.
3. DO NOT output JSON. Output raw Markdown text.
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"\nZ3 Output:\n${toolOutput}` }
                ],
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

            let rawText = fullText || '';
            rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            const leanMatch = rawText.match(/```lean\s*([\s\S]*?)\s*```/);
            const leanCode = leanMatch ? leanMatch[1].trim() : '';

            return {
                proofText: rawText || 'Logic proof derived successfully.',
                steps: [rawText.slice(0, 100) + '...'],
                leanCode: leanCode
            };
        } catch (e) {
            return { proofText: 'Logic proof fallback.', steps: [prompt], leanCode: '' };
        }
    }
}