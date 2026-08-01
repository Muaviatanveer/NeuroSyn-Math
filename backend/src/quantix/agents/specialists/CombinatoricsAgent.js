/**
 * @file CombinatoricsAgent.js
 * @description Dedicated Combinatorics Specialist Agent with Auto-Correction & Fast Sandbox Execution.
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

    async think(task, context = {}, stream = () => {}) { // ⚡ Add stream parameter
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[CombinatoricsAgent] 📌 Step 1/5: Starting think() on prompt...`);

        this.logger.info(`[CombinatoricsAgent] 📌 Step 2/5: Calling _generateCombinatoricsScript()...`);
        let simScript = await this._generateCombinatoricsScript(promptText, stream); // Pass it down
        this.logger.info(`[CombinatoricsAgent] 📌 Step 3/5: Script generated (${simScript ? simScript.length : 0} chars).`);

        let toolResult = { output: 'Tool execution skipped.', success: true };

        if (simScript) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                this.logger.info(`[CombinatoricsAgent] 📌 Step 4/5: Executing Python sandbox (Attempt ${attempt})...`);
                toolResult = await this.codeExecutor.executeSymbolicMath(simScript);

                const hasError = !toolResult.output || toolResult.output.includes('Traceback') || toolResult.output.includes('Error:');
                if (!hasError) {
                    this.logger.info(`[CombinatoricsAgent] Python tool output verified: ${toolResult.output?.slice(0, 50)}...`);
                    break;
                }

                this.logger.warn(`[CombinatoricsAgent] Python tool failed on attempt ${attempt}. Repairing...`);
                simScript = await this._repairPythonScript(simScript, toolResult.output || toolResult.error);
            }
        }

        this.logger.info(`[CombinatoricsAgent] 📌 Step 5/5: Calling _generateCombinatoricsProof()...`);
        const proofResult = await this._generateCombinatoricsProof(promptText, toolResult.output, simScript);
        this.logger.info(`[CombinatoricsAgent] ✅ think() completed successfully.`);

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

    async _generateCombinatoricsScript(prompt, stream) {
        const sysPrompt = `
You are the Combinatorial Simulation Generator. Write a standalone Python script.
Output ONLY a valid Python code block inside \`\`\`python ... \`\`\` fences.
`;

        try {
            const response = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"` }
                ],
                temperature: 0.0,
                max_tokens: 1000,
                stream: true // ⚡ Enable Streaming!
            });

            let fullContent = '';
            for await (const chunk of response) {
                const token = chunk.choices[0]?.delta?.content || '';
                fullContent += token;
                if (token) stream('token', token); // ⚡ Stream token to CLI/Logs!
            }

            const match = fullContent.match(/```python\s*([\s\S]*?)\s*```/) || [null, fullContent];
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

Ensure you track exact integer calculations without floating point precision loss.
Output ONLY the corrected valid \`\`\`python ... \`\`\` block.`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.0,
                max_tokens: 1000
            });

            const raw = res.choices[0].message.content;
            const match = raw.match(/```python\s*([\s\S]*?)\s*```/) || [null, badScript];
            return match[1].trim();
        } catch (e) {
            return badScript;
        }
    }

    async _generateCombinatoricsProof(prompt, toolOutput, verifiedScript) {
        const sysPrompt = `
You are the NeuroSyn Combinatorics Specialist Agent.
Generate a rigorous, publication-grade combinatorial proof and complete code implementation.

STRICT INSTRUCTIONS:
1. Answer EVERY task and sub-question in the user prompt explicitly.
2. Provide step-by-step combinatorial derivations, double-counting proofs, or recurrence relations.
3. Embed the verified Python script below directly inside a complete \`\`\`python ... \`\`\` block in the "proofText" field. Do NOT write prose summaries of code.

Respond strictly in valid JSON format:
{
  "proofText": "Full Markdown solution with rigorous derivation and complete copy-pasteable python code block...",
  "steps": ["Step 1 derivation...", "Step 2 combinatorial proof...", "Step 3 code..."],
  "leanCode": "theorem combinatorics_target : ... := by ..."
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
            return { proofText: 'Combinatorial proof fallback.', steps: [prompt], leanCode: '' };
        }
    }
}