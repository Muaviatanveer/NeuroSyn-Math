/**
 * @file GeometryAgent.js
 * @description Dedicated Geometry Specialist Agent for NeuroSyn-Math.
 * Handles Synthetic, Coordinate, Analytic, and Vector Geometry.
 * Uses SymPy Geometry as an external tool to test intersection, concurrency, and collinearity.
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

    /**
     * Executes geometric proof search with active Python SymPy Geometry calculation tools.
     */
    async think(task, context = {}) {
        const promptText = typeof task === 'string' ? task : (task.prompt || task.goal || JSON.stringify(task));
        this.logger.info(`[GeometryAgent] Processing geometric task: "${promptText.slice(0, 80)}..."`);

        // Step 1: Generate Coordinate / Vector Calculation Script
        const geometryScript = await this._generateGeometryScript(promptText);

        // Step 2: Run Python SymPy Geometry Execution
        let toolResult = { output: 'Tool execution skipped.', success: true };
        if (geometryScript) {
            this.logger.info('[GeometryAgent] 📐 Executing SymPy Geometry tool script in Python sandbox...');
            toolResult = await this.codeExecutor.executeSymbolicMath(geometryScript, ['sympy', 'numpy', 'matplotlib']);
            this.logger.info(`[GeometryAgent] Geometry Tool Output:\n${toolResult.output?.slice(0, 200)}`);
        }

        // Step 3: Produce Formal Synthetic / Coordinate Proof + Lean Code
        const proofResult = await this._generateGeometryProof(promptText, toolResult.output);

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
Write a Python script using \`sympy.geometry\` (Point, Line, Circle, Triangle) or vector linear algebra
to verify collinearity, concurrency, distance, or angle properties.

Output ONLY valid Python code block inside \`\`\`python ... \`\`\` fences.
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

    async _generateGeometryProof(prompt, toolOutput) {
        const sysPrompt = `
You are the NeuroSyn Geometry Specialist Agent.
Provide a rigorous geometric proof (Synthetic or Coordinate-based) and a Lean 4 block.
Incorporate the SymPy calculation results as verified facts.

Respond strictly in JSON:
{
  "proofText": "Full step-by-step geometric proof...",
  "steps": ["Step 1...", "Step 2..."],
  "leanCode": "theorem geometry_target : ... := by ..."
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
                temperature: 0.1
            });

            return JSON.parse(res.choices[0].message.content);
        } catch (e) {
            return { proofText: 'Geometric proof fallback.', steps: [prompt], leanCode: '' };
        }
    }
}