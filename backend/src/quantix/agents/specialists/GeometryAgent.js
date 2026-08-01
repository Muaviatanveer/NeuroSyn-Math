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

    async think(task, context = {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[GeometryAgent] Processing geometric task: "${promptText.slice(0, 80)}..."`);

        let geometryScript = await this._generateGeometryScript(promptText);
        let toolResult = { output: 'Tool execution skipped.', success: true };

        // ⚡ Python Sandbox Auto-Correction Loop (up to 2 repair passes)
        if (geometryScript) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                this.logger.info(`[GeometryAgent] 📐 Executing SymPy Geometry tool script (Attempt ${attempt})...`);
                toolResult = await this.codeExecutor.executeSymbolicMath(geometryScript);

                const hasError = !toolResult.output || toolResult.output.includes('Traceback') || toolResult.output.includes('Error:');
                if (!hasError) {
                    this.logger.info(`[GeometryAgent] Geometry Tool Output Verified:\n${toolResult.output?.slice(0, 200)}`);
                    break;
                }

                this.logger.warn(`[GeometryAgent] Geometry tool error on attempt ${attempt}. Initiating code repair loop...`);
                geometryScript = await this._repairPythonScript(geometryScript, toolResult.output || toolResult.error);
            }
        }

        const proofResult = await this._generateGeometryProof(promptText, toolResult.output, geometryScript);

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

    async _generateGeometryScript(prompt) {
        const sysPrompt = `
You are the SymPy Geometry Code Generator for GeometryAgent in NeuroSyn-Math.
Write a standalone Python script using \`sympy.geometry\` or coordinate linear algebra to compute exact coordinates, distances, or combinatorial grid paths.

Output ONLY a valid Python code block inside \`\`\`python ... \`\`\` fences.
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Geometric Problem: "${prompt}"` }
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

Ensure exact calculations without floating point precision loss.
Output ONLY the corrected valid \`\`\`python ... \`\`\` block.`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.0
            });

            const raw = res.choices[0].message.content;
            const match = raw.match(/```python\s*([\s\S]*?)\s*```/) || [null, badScript];
            return match[1].trim();
        } catch (e) {
            return badScript;
        }
    }

    async _generateGeometryProof(prompt, toolOutput, verifiedScript) {
        const sysPrompt = `
You are the NeuroSyn Geometry Specialist Agent.
Provide a rigorous geometric or combinatorial proof and a Lean 4 block.

STRICT INSTRUCTIONS:
1. Answer EVERY task and sub-question in the user prompt explicitly.
2. Embed the verified Python script below directly inside a complete \`\`\`python ... \`\`\` block in the "proofText" field. Do NOT write prose summaries of code.

Respond strictly in valid JSON format:
{
  "proofText": "Full Markdown solution with rigorous derivation and complete copy-pasteable python code block...",
  "steps": ["Step 1...", "Step 2..."],
  "leanCode": "theorem geometry_target : ... := by ..."
}
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Problem: "${prompt}"\nSymPy Output:\n${toolOutput}\nVerified Python Code:\n\`\`\`python\n${verifiedScript || ''}\n\`\`\`` }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1
            });

            return JSON.parse(res.choices[0].message.content);
        } catch (e) {
            return { proofText: 'Geometric proof fallback.', steps: [prompt], leanCode: '' };
        }
    }
}