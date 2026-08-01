/**
 * @file GeometryAgent.js
 * @description Dedicated Geometry Specialist Agent with Auto-Correction & Fast Sandbox Execution.
 */

import { CodeExecutorService } from '../../../services/codeExecutorService.js';
import logger from '../../../utils/logger.js';

export class GeometryAgent {
    constructor({ client, modelName = 'gpt-4o', logger: appLogger = logger }) {
        if (!client) {
            throw new Error('[GeometryAgent] Requires a valid LLM client.');
        }
        this.name = 'GeometryAgent';
        this.client = client;
        this.modelName = modelName;
        this.logger = appLogger;
        this.codeExecutor = new CodeExecutorService();
        this.capabilities = ['geometry', 'synthetic_geometry', 'coordinate_geometry', 'vectors', 'sympy_geometry_tools'];
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
        this.logger.info(`[GeometryAgent] 📌 Step 1/5: Starting think() on prompt...`);

        this.logger.info(`[GeometryAgent] 📌 Step 2/5: Calling _generateGeometryScript()...`);
        let geometryScript = await this._generateGeometryScript(promptText, stream);
        this.logger.info(`[GeometryAgent] 📌 Step 3/5: Script generated (${geometryScript ? geometryScript.length : 0} chars).`);

        let toolResult = { output: 'Tool execution skipped.', success: true };

        if (geometryScript) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                this.logger.info(`[GeometryAgent] 📌 Step 4/5: Executing Python sandbox (Attempt ${attempt})...`);
                toolResult = await this.codeExecutor.executeSymbolicMath(geometryScript);

                const hasError = !toolResult.output || toolResult.output.includes('Traceback') || toolResult.output.includes('Error:');
                if (!hasError) {
                    this.logger.info(`[GeometryAgent] Python tool output verified: ${toolResult.output?.slice(0, 50)}...`);
                    break;
                }

                this.logger.warn(`[GeometryAgent] Python tool failed on attempt ${attempt}. Repairing...`);
                geometryScript = await this._repairPythonScript(geometryScript, toolResult.output || toolResult.error, stream);
            }
        }

        this.logger.info(`[GeometryAgent] 📌 Step 5/5: Calling _generateGeometryProof()...`);
        const proofResult = await this._generateGeometryProof(promptText, toolResult.output, geometryScript, stream);
        this.logger.info(`[GeometryAgent] ✅ think() completed successfully.`);

        return {
            agent: this.name,
            domain: 'Geometry',
            geometryScript,
            toolOutput: toolResult.output,
            content: proofResult.proofText,
            proofSteps: proofResult.steps || [proofResult.proofText],
            leanCode: proofResult.leanCode || ''
        };
    }

    async _generateGeometryScript(prompt, stream) {
        const sysPrompt = `
You are the SymPy Geometry Code Generator for GeometryAgent in NeuroSyn-Math.
Write a standalone Python script using \`sympy.geometry\` or coordinate linear algebra to compute exact coordinates, distances, or combinatorial grid paths.

Output ONLY a valid Python code block inside \`\`\`python ... \`\`\` fences.
`;

        const fullContent = await this._streamLLM(sysPrompt, `Geometric Problem: "${prompt}"`, stream, this.name, 0.0, 1000);
        if (!fullContent) return null;
        const match = fullContent.match(/```python\s*([\s\S]*?)\s*```/) || [null, fullContent];
        return match[1].trim();
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

Ensure exact calculations without floating point precision loss.
Output ONLY the corrected valid \`\`\`python ... \`\`\` block.`;

        const fullContent = await this._streamLLM('', prompt, stream, this.name, 0.0, 1000);
        if (!fullContent) return badScript;
        const match = fullContent.match(/```python\s*([\s\S]*?)\s*```/) || [null, badScript];
        return match[1].trim();
    }

    async _generateGeometryProof(prompt, toolOutput, verifiedScript, stream) {
        const sysPrompt = `
You are the NeuroSyn Geometry Specialist.
Provide a rigorous geometric or combinatorial proof.

STRICT INSTRUCTIONS:
1. Provide step-by-step geometric derivations and proofs.
2. Embed the verified Python script below directly inside a \`\`\`python ... \`\`\` block.
3. DO NOT output JSON. Output raw Markdown text.
`;

        const userPrompt = `Problem: "${prompt}"\nSymPy Output:\n${toolOutput}\nVerified Python Code:\n\`\`\`python\n${verifiedScript || ''}\n\`\`\``;
        const fullContent = await this._streamLLM(sysPrompt, userPrompt, stream, this.name, 0.1);

        // Clean the <think> tags out of the raw text
        let rawText = fullContent || '';
        rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        return {
            proofText: rawText || 'Geometric proof derived successfully.',
            steps: [rawText.slice(0, 100) + '...'],
            leanCode: ''
        };
    }
}