/**
 * @file src/quantix/meta/neuroPlanner.js
 * @description Strategic Proof Planner for NeuroSyn-Math. Produces structured multi-strategy 
 * proof plans, sub-goal dependency graphs, and domain specialist assignments.
 */
import logger from '../../utils/logger.js';

export class NeuroPlanner {
    constructor({ client, clients, logger: appLogger = logger, model = 'gpt-4o' } = {}) {
        const activeClient = client || clients?.openai || clients?.deepseek || clients?.anthropic;
        if (!activeClient) {
            throw new Error("[NeuroSyn-Math] NeuroPlanner requires an LLM client.");
        }
        this.client = activeClient;
        this.logger = appLogger;
        this.model = model;
    }

    /**
     * Generates a multi-strategy proof plan based on structured problem context and feedback.
     * @param {object} problemObject Structured problem from ProblemParser.
     * @param {string|null} feedback Critique or Lean compiler diagnostic feedback.
     * @returns {Promise<object>} Structured strategic plan object.
     */
    async createPlan(problemObject, feedback = null) {
        const domain = problemObject.primaryDomain || 'Algebra';
        const goal = problemObject.goal?.statement || problemObject.naturalText;

        this.logger.info(`[NeuroPlanner] Designing proof strategy matrix for domain: ${domain}, goal: "${goal?.slice(0, 80)}..."`);

        if (feedback) {
            this.logger.info(`[NeuroPlanner] Applying revision feedback: "${feedback.slice(0, 100)}..."`);
        }

        const prompt = this.createPrompt(problemObject, feedback);

        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.2
            });

            const parsed = JSON.parse(response.choices[0].message.content);
            const planSteps = parsed.steps || parsed.plan || [];

            if (planSteps.length === 0) {
                return this.createFallbackPlan(problemObject);
            }

            this.logger.info(`[NeuroPlanner] Strategic plan created with ${planSteps.length} sub-goal nodes.`);
            return {
                domain,
                strategies: parsed.strategies || ['Direct Deduction'],
                steps: planSteps,
                leanOutline: parsed.leanOutline || ''
            };

        } catch (error) {
            this.logger.error(`[NeuroPlanner] Strategic planning failed: ${error.message}. Returning fallback strategy.`);
            return this.createFallbackPlan(problemObject);
        }
    }

    createPrompt(problemObject, feedback) {
        const feedbackBlock = feedback
            ? `\nCRITICAL FIX REQUIRED FROM PREVIOUS ATTEMPT:\nThe previous proof path failed with error: "${feedback}". You MUST adapt the strategy to fix this exact issue.\n`
            : '';

        return `
You are the NeuroSyn Strategic Proof Planner.
Design a proof plan for the following problem:

**Goal:** "${problemObject.goal?.statement || problemObject.naturalText}"
**Primary Domain:** ${problemObject.primaryDomain || 'Algebra'}
**Domains Involved:** ${JSON.stringify(problemObject.domains || ['Algebra'])}
**LaTeX Formalization:** "${problemObject.formalRepresentation?.latex || 'N/A'}"
**Constraints:** ${JSON.stringify(problemObject.constraints?.knownAssumptions || [])}
${feedbackBlock}

Provide a JSON output matching this schema:
{
  "strategies": [
    "Primary Strategy (e.g. Proof by Contradiction)",
    "Alternative Strategy (e.g. Induction on n)"
  ],
  "steps": [
    {
      "id": "step_1",
      "goal": "State the base case or initial assumption",
      "specialist": "AlgebraAgent",
      "requiredTechnique": "Modular Arithmetic",
      "dependsOn": []
    },
    {
      "id": "step_2",
      "goal": "Derive contradiction or main inductive step",
      "specialist": "LogicAgent",
      "requiredTechnique": "Proof by Contradiction",
      "dependsOn": ["step_1"]
    }
  ],
  "leanOutline": "theorem problem ... := by \\n  sorry"
}
`;
    }

    createFallbackPlan(problemObject) {
        return {
            domain: problemObject.primaryDomain || 'Algebra',
            strategies: ['Direct Deduction'],
            steps: [
                { id: 'step_1', goal: 'State assumptions and setup definitions', specialist: 'LogicAgent', dependsOn: [] },
                { id: 'step_2', goal: 'Apply algebraic identities or core lemmas', specialist: 'AlgebraAgent', dependsOn: ['step_1'] },
                { id: 'step_3', goal: 'Derive final theorem statement', specialist: 'LogicAgent', dependsOn: ['step_2'] }
            ],
            leanOutline: 'theorem fallback := by sorry'
        };
    }
}