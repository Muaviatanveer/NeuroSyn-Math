/**
 * @file src/quantix/meta/taskConstructor.js
 * @description NeuroSyn Task Constructor. Converts high-level proof plan steps 
 * into detailed, executable task graph nodes with explicit inputs, outputs, and dependencies.
 */
import logger from '../../utils/logger.js';

import { getModelForRole } from '../../config/clients.js';

export class TaskConstructor {
    constructor({ client, logger: appLogger = logger, model }) {
        if (!client) {
            throw new Error("[NeuroSyn-Math] TaskConstructor requires an LLM client.");
        }
        this.client = client;
        this.logger = appLogger;
        this.model = model || getModelForRole('meta_planner');
    }

    /**
     * Constructs an executable Task Graph DAG from strategic plan steps.
     * @param {string[]|object[]} planSteps Array of plan steps or sub-goal objects from NeuroPlanner.
     * @param {object} problemContext Structured problem context from ProblemParser.
     * @returns {Promise<object[]>} Detailed task graph node array.
     */
    async buildGraph(planSteps, problemContext) {
        this.logger.info(`[TaskConstructor] Constructing Task Graph for ${planSteps.length} strategic steps...`);

        const graph = [];

        for (let i = 0; i < planSteps.length; i++) {
            const step = planSteps[i];
            const stepText = typeof step === 'string' ? step : (step.goal || step.name || JSON.stringify(step));
            const previousTask = i > 0 ? graph[i - 1] : null;

            try {
                const detailedTask = await this._detailTask(stepText, problemContext, previousTask);
                detailedTask.id = `task_${i + 1}`;
                detailedTask.dependencies = previousTask ? [previousTask.id] : [];
                graph.push(detailedTask);
            } catch (err) {
                this.logger.error(`[TaskConstructor] Failed to detail step #${i + 1}: ${err.message}`);
                graph.push({
                    id: `task_${i + 1}`,
                    name: stepText,
                    type: 'proof_deduction',
                    prompt: `Execute mathematical step: ${stepText}`,
                    dependencies: previousTask ? [previousTask.id] : [],
                    required_inputs: previousTask ? [previousTask.id] : [],
                    expected_output: "Mathematical proof step analysis."
                });
            }
        }

        this.logger.info(`[TaskConstructor] Successfully generated Task Graph with ${graph.length} nodes.`);
        return graph;
    }

    /**
     * Generates detailed execution prompt and constraints for a single task node.
     */
    async _detailTask(stepText, problemContext, previousTask) {
        const prompt = this._createDetailingPrompt(stepText, problemContext, previousTask);

        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.1
            });

            let rawContent = response?.choices?.[0]?.message?.content || '';
            let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start !== -1 && end !== -1 && start <= end) {
                cleaned = cleaned.substring(start, end + 1);
            }
            if (!cleaned) throw new Error("Empty response from LLM during task detailing.");
            const details = JSON.parse(cleaned);
            return {
                name: stepText,
                ...details
            };
        } catch (error) {
            return {
                name: stepText,
                type: 'proof_deduction',
                prompt: `Solve mathematical step: "${stepText}" for problem: "${problemContext.goal?.statement || problemContext.naturalText}".`,
                required_inputs: previousTask ? [`Output from '${previousTask.name}'`] : [],
                expected_output: "Step proof statement with justifications."
            };
        }
    }

    _createDetailingPrompt(stepText, problemContext, previousTask) {
        const prevContext = previousTask
            ? `Previous Step '${previousTask.name}' produced: '${previousTask.expected_output}'.`
            : 'This is the initial step of the proof.';

        return `
You are the NeuroSyn Task Constructor.
Convert this high-level proof plan step into an actionable execution node.

**Problem:** ${problemContext.goal?.statement || problemContext.naturalText}
**Domain:** ${problemContext.primaryDomain || 'Algebra'}
**Current Step:** "${stepText}"
**Context:** ${prevContext}

**CRITICAL SAFEGUARDS FOR SYMBOLIC PYTHON SCRIPT GENERATION:**
If this task involves writing Python or SymPy code:
1. Include \`import sys; sys.setrecursionlimit(3000)\`.
2. Use memoization (\`@functools.lru_cache\`) for recursive functions.
3. Catch exceptions and print structured JSON results.

Task Classification Types:
- 'proof_deduction': Formal deductive proof reasoning step.
- 'symbolic_calculation': SymPy / exact numerical computation.
- 'counterexample_fuzzing': Automated boundary SMT/SAT testing.
- 'lean_formalization': Lean 4 tactic writing.
- 'verification': Checking logical steps.

Respond strictly in JSON:
{
  "type": "proof_deduction",
  "prompt": "Detailed task instructions for specialist agent...",
  "required_inputs": ["Input required from previous steps"],
  "expected_output": "Expected mathematical output or proof statement"
}
`;
    }
}
