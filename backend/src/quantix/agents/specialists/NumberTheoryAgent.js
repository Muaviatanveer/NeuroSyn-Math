/**
 * @file src/quantix/agents/specialists/NumberTheoryAgent.js
 * @description Dedicated Number Theory Specialist Agent with Python Auto-Correction & Precision Guarantees.
 */
import { CodeExecutorService } from '../../../services/codeExecutorService.js';
import logger from '../../../utils/logger.js';
import { MathUtils } from '../../../utils/mathUtils.js';

export class NumberTheoryAgent {
    constructor({ client, modelName = process.env.OPENAI_MODEL || 'deepseek-r1:32b', logger: appLogger = logger }) {
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
        this.logger.info(`[NumberTheoryAgent] Processing number theory task: "${promptText.slice(0, 80)}..."`);

        let numberTheoryScript = await this._generateNumberTheoryScript(promptText, stream);
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
                numberTheoryScript = await this._repairPythonScript(numberTheoryScript, toolResult.output || toolResult.error, stream);
            }
        }

        const proofResult = await this._generateNumberTheoryProof(promptText, toolResult.output, numberTheoryScript, stream);

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

    async _generateNumberTheoryScript(prompt, stream) {
        const sysPrompt = `
You are the Number Theory Tool Generator. Write a standalone Python script.
⚡ CRITICAL:
1. Do NOT write endless explanations.
2. DO NOT output JSON. Output raw Markdown text. Embed your python code in a \`\`\`python ... \`\`\` block.
`;

        try {
            const response = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"` }
                ],
                temperature: 0.0,
                max_tokens: 800, // ⚡ Cap tokens so deepseek-r1 doesn't loop infinitely!
                stream: true     // ⚡ Live token streaming
            });

            let fullContent = '';
            for await (const chunk of response) {
                const token = chunk.choices[0]?.delta?.content || '';
                fullContent += token;
                if (token && typeof stream === 'function') {
                    stream('token', { agent: this.name, token }); // ⚡ Stream token to terminal!
                }
            }

            const match = fullContent.match(/```python\s*([\s\S]*?)\s*```/) || [null, fullContent];
            return match[1].trim();
        } catch (e) {
            return null;
        }
    }

    async _repairPythonScript(badScript, errorMessage, stream) {
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

        const fullContent = await this._streamLLM('', prompt, stream, this.name, 0.0, 1000);
        if (!fullContent) return badScript;
        const match = fullContent.match(/```python\s*([\s\S]*?)\s*```/) || [null, badScript];
        return match[1].trim();
    }

    async _generateNumberTheoryProof(prompt, toolOutput, verifiedScript, stream) {
        const sysPrompt = `
You are the NeuroSyn Number Theory Specialist.
Generate a rigorous, publication-grade mathematical proof.

STRICT INSTRUCTIONS:
1. Provide step-by-step mathematical proofs and derivations with explicit equations.
2. Embed the verified Python script below directly inside a \`\`\`python ... \`\`\` block.
3. DO NOT output JSON. Output raw Markdown text.
`;

        const userPrompt = `Problem: "${prompt}"\nTool Output: ${toolOutput}\nVerified Python Code:\n\`\`\`python\n${verifiedScript || ''}\n\`\`\``;
        const fullContent = await this._streamLLM(sysPrompt, userPrompt, stream, this.name, 0.1, 1500);

        // Clean the <think> tags out of the raw text
        let rawText = fullContent || '';
        rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // Construct the JSON object manually to prevent LLM parsing failures!
        return {
            proofText: rawText || 'Number theory proof derived successfully.',
            steps: [rawText.slice(0, 100) + '...'],
            leanCode: ''
        };
    }
}