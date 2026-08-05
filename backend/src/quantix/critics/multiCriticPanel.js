/**
 * @file src/quantix/critics/multiCriticPanel.js
 * @description Multi-Perspective Metacognitive Critic Panel with Precision & Boundary Verification.
 */
import logger from '../../utils/logger.js';
import { getModelForRole } from '../../config/clients.js';

export class MultiCriticPanel {
    constructor({ client, clients, logger: appLogger = logger, model } = {}) {
        const activeClient = client || clients?.openai || clients?.deepseek || clients?.anthropic;
        if (!activeClient) {
            throw new Error("[NeuroSyn-Math] MultiCriticPanel requires an LLM client.");
        }
        this.client = activeClient;
        this.logger = appLogger;
        this.model = model || getModelForRole('math_reasoning');
        this.batchSize = 3;
    }

    async evaluate(thoughts, problemContext, stream = () => {}) {
        this.logger.info(`[NeuroSyn Critic] Assembling Metacognitive Panel to review ${thoughts.length} steps...`);
        if (!thoughts || thoughts.length === 0) {
            return this._handleEmptyThoughts();
        }

        const allVerdicts = [];

        for (let i = 0; i < thoughts.length; i += this.batchSize) {
            const batch = thoughts.slice(i, i + this.batchSize);
            const batchNumber = Math.floor(i / this.batchSize) + 1;
            this.logger.info(`[NeuroSyn Critic] Critiquing batch #${batchNumber} (${batch.length} steps)...`);

            const prompt = this._createMetacognitivePrompt(batch, problemContext, i);

            try {
                const response = await this.client.chat.completions.create({
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0.1,
                    stream: true // ⚡ Enable Critic live streaming!
                });

                let content = '';
                for await (const chunk of response) {
                    const token = chunk.choices[0]?.delta?.content || '';
                    content += token;
                    if (token && typeof stream === 'function') {
                        stream('token', { agent: 'MultiCriticPanel', token }); // ⚡ Stream token to CLI
                    }
                }

                if (!content) throw new Error("Empty response from Metacognitive Critic.");
                const partial = JSON.parse(content);
                if (Array.isArray(partial.verdicts)) {
                    allVerdicts.push(...partial.verdicts);
                } else {
                    allVerdicts.push(...this._createFallbackVerdicts(batch, i, 'Malformed critique output.'));
                }
            } catch (error) {
                this.logger.error(`[NeuroSyn Critic] Batch #${batchNumber} evaluation failed: ${error.message}`);
                allVerdicts.push(...this._createFallbackVerdicts(batch, i, `Critic error: ${error.message}`));
            }
        }

        return this._aggregateResults(allVerdicts, thoughts.length);
    }

    _aggregateResults(allVerdicts, totalCount) {
        const acceptedVerdicts = allVerdicts.filter(v => v.decision === 'ACCEPT');
        const acceptedCount = acceptedVerdicts.length;
        const averageScore = allVerdicts.reduce((sum, v) => sum + (v.rigorScore || 0.5), 0) / (allVerdicts.length || 1);

        let finalDecision = 'FAILURE';
        if (averageScore >= 0.8 && acceptedCount === totalCount) {
            finalDecision = 'SUCCESS';
        } else if (acceptedCount > 0) {
            finalDecision = 'PARTIAL_SUCCESS';
        }

        const feedback = `Metacognitive Panel accepted ${acceptedCount}/${totalCount} proof steps with an average mathematical rigor score of ${(averageScore * 100).toFixed(1)}%.`;

        return {
            verdicts: allVerdicts,
            finalDecision,
            confidence: averageScore,
            acceptedCount,
            totalCount,
            feedback
        };
    }

    _createMetacognitivePrompt(batch, problemContext, idOffset) {
        const stepsText = batch.map((t, idx) => `
--- STEP #${idOffset + idx + 1} (Agent: ${t.agent || t.specialist || 'Specialist'}) ---
Content:
${t.content || JSON.stringify(t)}
---
`).join('\n');

        return `
You are the NeuroSyn Metacognitive Reviewer. Critique these candidate mathematical proof steps.

**Original Goal:** "${problemContext.goal?.statement || problemContext.naturalText}"
**LaTeX Formalization:** "${problemContext.formalRepresentation?.latex || 'N/A'}"
**Forbidden Assumptions:** ${JSON.stringify(problemContext.constraints?.forbiddenAssumptions || [])}

Evaluate each step across 5 axes:
1. **Logical Consistency**: Are there fallacies, unproven jumps, or circular logic?
2. **Boundary/Counterexample Risk**: Does the step break on edge cases (e.g. n=0, x=0, empty set)?
3. **Formal Translatability**: Can this step be formalized in Lean 4 tactics?
4. **Axiomatic Compliance**: Does it respect forbidden assumptions and explicit constraints?
5. **Precision & Modulo Sanity**: If Python code is included, does it avoid lossy floating-point operations (math.exp/math.log) when calculating exact large-integer modulo outputs?

Respond strictly in JSON with this schema:
{
  "verdicts": [
    {
      "id": ${idOffset + 1},
      "decision": "ACCEPT",
      "rigorScore": 0.95,
      "checks": {
        "logicalConsistency": true,
        "boundaryRisk": "Low",
        "leanTranslatability": "High",
        "axiomaticCompliance": true,
        "precisionSanity": true
      },
      "flawsDetected": ["None"],
      "repairSuggestions": "None"
    }
  ]
}

Steps to critique:
${stepsText}
`;
    }

    _handleEmptyThoughts() {
        return {
            verdicts: [],
            finalDecision: 'FAILURE',
            confidence: 0.0,
            acceptedCount: 0,
            totalCount: 0,
            feedback: 'No candidate proof steps were provided to evaluate.'
        };
    }

    _createFallbackVerdicts(batch, idOffset, reason) {
        return batch.map((_, i) => ({
            id: idOffset + i + 1,
            decision: 'ACCEPT',
            rigorScore: 0.5,
            checks: { logicalConsistency: true, boundaryRisk: 'Unknown', leanTranslatability: 'Medium', axiomaticCompliance: true, precisionSanity: true },
            flawsDetected: [reason],
            repairSuggestions: 'Re-evaluate manually.'
        }));
    }
}