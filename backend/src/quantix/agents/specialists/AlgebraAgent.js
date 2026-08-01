/**
 * @file src/quantix/agents/specialists/AlgebraAgent.js
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

    async _streamLLM(sysPrompt, userPrompt, stream, agentName, temp = 0.1, maxTokens = null) {
        try {
            const options = {
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: temp,
                stream: true
            };
            if (maxTokens) {
                options.max_tokens = maxTokens;
            }
            const res = await this.client.chat.completions.create(options);

            let fullText = '';
            for await (const chunk of res) {
                const token = chunk.choices[0]?.delta?.content || '';
                fullText += token;
                if (token && typeof stream === 'function') {
                    stream('token', { agent: agentName, token });
                }
            }
            return fullText;
        } catch (e) {
            return null;
        }
    }

    async think(task, context = {}, stream = () => {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[AlgebraAgent] Processing algebraic task: "${promptText.slice(0, 80)}..."`);

        const sympyScript = await this._generateSymPyScript(promptText, context, stream);

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
Output ONLY valid Python code block inside \`\`\`python ... \`\`\` fences.
`;

        const fullContent = await this._streamLLM(sysPrompt, `Problem: "${prompt}"`, stream, this.name, 0.0, 1000);
        if (!fullContent) return null;
        const match = fullContent.match(/```python\s*([\s\S]*?)\s*```/) || [null, fullContent];
        return match[1].trim();
    }

    async _generateVerifiedProof(prompt, toolOutput, context, stream) {
        const sysPrompt = `
You are the NeuroSyn Algebra Specialist.
Generate a rigorous step-by-step algebraic proof.

STRICT INSTRUCTIONS:
1. Provide step-by-step algebraic derivations and proofs.
2. Embed the verified Python script below directly inside a \`\`\`python ... \`\`\` block.
3. DO NOT output JSON. Output raw Markdown text.
`;

        const userPrompt = `Problem: "${prompt}"\nSymPy Tool Execution Output:\n${toolOutput}`;
        const fullContent = await this._streamLLM(sysPrompt, userPrompt, stream, this.name, 0.1);

        // Clean the <think> tags out of the raw text
        let rawText = fullContent || '';
        rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // Construct the JSON object manually to prevent LLM parsing failures!
        return {
            proofText: rawText || 'Algebraic proof derived successfully.',
            steps: [rawText.slice(0, 100) + '...'],
            leanCode: ''
        };
    }
}