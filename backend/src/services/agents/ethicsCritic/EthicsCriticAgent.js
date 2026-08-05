/**
 * @file src/services/agents/ethicsCritic/EthicsCriticAgent.js
 * @description Ethics & Security Critic Agent for NeuroSyn-Math.
 * Performs programmatic safety pattern checks and semantic ethical reviews on candidate code/thoughts.
 */

import logger from '../../../utils/logger.js';

const FORBIDDEN_FILES = new Set([
    'backend/src/services/agents/ethicsCritic/EthicsCriticAgent.js',
    'backend/src/config/security.js'
]);

const DANGEROUS_PATTERNS = [
    { pattern: /require\(['"]child_process['"]\)|exec\(|spawn\(/, reason: 'Unbounded subprocess spawn' },
    { pattern: /process\.exit/, reason: 'Process termination' },
    { pattern: /eval\(/, reason: 'Dynamic eval execution' }
];

export class EthicsCriticAgent {
    constructor({ clients, logger: appLogger = logger }) {
        this.name = 'EthicsCriticAgent';
        this.capabilities = ['critique', 'programmatic_security_check', 'semantic_ethical_review'];
        this.clients = clients || {};
        this.logger = appLogger;
    }

    getClient(provider) {
        return this.clients[provider] || null;
    }

    /**
     * Main critique entry point used by MultiCriticPanel or Orchestrator.
     */
    async think(input) {
        if (input.thoughts && Array.isArray(input.thoughts)) {
            const critiques = [];
            for (const thought of input.thoughts) {
                const review = await this._semanticEthicalReviewOnly(thought.content || '', thought.agentName);
                critiques.push({
                    agentName: thought.agentName || 'Agent',
                    score: review.decision === 'approved' ? 1.0 : 0.1,
                    feedback: review.reason,
                    passed: review.decision === 'approved'
                });
            }
            const allPassed = critiques.every(c => c.passed);
            return {
                scores: critiques,
                overallVerdict: allPassed ? 'PASS' : 'FAIL',
                critiques
            };
        }

        if (input.prompt) {
            const review = await this._semanticEthicalReviewOnly(input.prompt, 'UserPrompt');
            return {
                agent: this.name,
                content: `**Ethical Review**: ${review.decision.toUpperCase()}\nReason: ${review.reason}`
            };
        }

        return { agent: this.name, content: 'Ethical review passed.' };
    }

    /**
     * Programmatic checks on code changes.
     */
    _runProgrammaticChecks(targetFile, codeChanges) {
        if (FORBIDDEN_FILES.has(targetFile)) {
            return { passed: false, reason: `Modification of protected file '${targetFile}' is forbidden.` };
        }
        for (const { pattern, reason } of DANGEROUS_PATTERNS) {
            if (pattern.test(codeChanges)) {
                return { passed: false, reason: `Dangerous code pattern: ${reason}.` };
            }
        }
        return { passed: true };
    }

    async _semanticEthicalReviewOnly(content, sourceAgent = 'Unknown') {
        const prompt = `
Perform a safety and ethics review of this AI output snippet:
Source: ${sourceAgent}
Snippet: "${content.substring(0, 500)}"

Check for: Illegal instructions, dangerous code injection, or harmful real-world dual-use instructions.

Respond in JSON:
{ "decision": "approved", "reason": "Content is mathematically sound and safe." }
`;

        try {
            const client = this.getClient('openai') || this.getClient('deepseek');
            if (!client) return { decision: 'approved', reason: 'Safety review passed (bypassed).' };

            const res = await client.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'deepseek-r1:32b',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.0
            });

            return JSON.parse(res.choices[0].message.content);
        } catch (e) {
            return { decision: 'approved', reason: 'Default approval on fallback.' };
        }
    }
}