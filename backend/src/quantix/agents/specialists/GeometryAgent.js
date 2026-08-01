/**
 * @file GeometryAgent.js
 * @description Dedicated Geometry Specialist Agent with Live Token Streaming.
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

    async think(task, context = {}, stream = () => {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[GeometryAgent] Processing geometric task: "${promptText.slice(0, 80)}..."`);

        let geometryScript = await this._generateGeometryScript(promptText, stream);
        let toolResult = { output: 'Tool execution skipped.', success: true };

        if (geometryScript) {
            this.logger.info('[GeometryAgent] 📐 Executing SymPy Geometry tool script in Python sandbox...');
            toolResult = await this.codeExecutor.executeSymbolicMath(geometryScript);
            this.logger.info(`[GeometryAgent] Geometry Tool Output:\n${toolResult.output?.slice(0, 200)}`);
        }

        const proofResult = await this._generateGeometryProof(promptText, toolResult.output, geometryScript, stream);

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
Write a standalone Python script using \`sympy.geometry\` or coordinate linear algebra to compute exact coordinates or distances.
Output ONLY a valid Python code block inside \`\`\`python ... \`\`\` fences.
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: `Geometric Problem: "${prompt}"` }
                ],
                temperature: 0.0,
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

    async _generateGeometryProof(prompt, toolOutput, verifiedScript, stream) {
        const sysPrompt = `
You are the NeuroSyn Geometry Specialist Agent.
Provide a rigorous geometric or combinatorial proof and a Lean 4 block.

STRICT INSTRUCTIONS:
1. Answer EVERY task and sub-question in the user prompt explicitly.
2. Embed the verified Python script below directly inside a complete \`\`\`python ... \`\`\` block in the "proofText" field.

Respond strictly in JSON format:
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
                temperature: 0.1,
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

            return JSON.parse(fullText);
        } catch (e) {
            return { proofText: 'Geometric proof fallback.', steps: [prompt], leanCode: '' };
        }
    }
}