/**
 * @file src/quantix/synthesis/synthesizer.js
 * @description NeuroSyn-Math Explanation & Synthesis Engine.
 * Consolidates verified specialist thoughts into a rigorous deductive proof, formats
 * Lean 4 code, and generates multi-tier human explanations (Research Paper, Undergraduate, ELI5).
 */
import logger from '../../utils/logger.js';
import ProofObject from '../proofFormats/proofObject.js';

import { getModelForRole } from '../../config/clients.js';

export class Synthesizer {
    constructor({ client, logger: appLogger = logger, model }) {
        if (!client) {
            throw new Error("[NeuroSyn-Math] Synthesizer requires an LLM client.");
        }
        this.client = client;
        this.logger = appLogger;
        this.model = model || getModelForRole('math_reasoning');
    }

    /**
     * Synthesizes accepted thoughts, proof steps, and verification context into a complete solution.
     * @param {object} problemContext Structured problem context from ProblemParser.
     * @param {object[]} acceptedThoughts Accepted specialist thoughts or proof steps.
     * @param {string} feedback Metacognitive or compiler feedback.
     * @param {object} verificationStatus Formal verification report (Lean 4 / SMT).
     * @returns {Promise<object>} Complete synthesized output object.
     */
    async synthesize(problemContext, acceptedThoughts = [], feedback = '', verificationStatus = {}) {
        this.logger.info(`[Synthesizer] Initiating synthesis pipeline for ${acceptedThoughts.length} verified steps...`);

        if (!acceptedThoughts || acceptedThoughts.length === 0) {
            return this._handleEmptySynthesis(feedback);
        }

        try {
            // STAGE 1: Consolidate Raw Deductive Proof Steps and Lean Code
            const s1_logicalProof = await this._stage1_consolidateProof(problemContext, acceptedThoughts, feedback);

            // STAGE 2: Multi-Tier Explanation Generation (Research, Undergrad, ELI5)
            const s2_explanations = await this._stage2_generateExplanations(problemContext, s1_logicalProof, feedback);

            const proofObj = new ProofObject({
                problem: problemContext.goal?.statement || problemContext.naturalText,
                solver: 'NeuroSyn-Math',
                finalAnswer: s1_logicalProof.conclusion || problemContext.goal?.statement,
                solutionCode: s1_logicalProof.symbolicScript || '',
                leanCode: s1_logicalProof.leanCode || problemContext.formalRepresentation?.lean4Signature || '',
                reasoningSummary: s2_explanations.undergraduate || '',
                domain: problemContext.primaryDomain || 'Algebra',
                verified: verificationStatus.verified || false
            });

            return {
                success: true,
                proofObject: proofObj,
                logicalProof: s1_logicalProof,
                explanations: s2_explanations,
                verificationCertificate: {
                    leanVerified: verificationStatus.verified || false,
                    leanError: verificationStatus.error || null,
                    confidenceScore: verificationStatus.confidence || 0.9,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error(`[Synthesizer] Synthesis pipeline failure: ${error.message}`);
            return {
                success: false,
                error: error.message,
                fallbackText: `Synthesis failed: ${error.message}`
            };
        }
    }

    /**
     * Stage 1: Consolidates thoughts into a structured deductive proof step graph.
     */
    async _stage1_consolidateProof(problemContext, thoughts, feedback) {
        const thoughtsText = thoughts.map((t, idx) => `
[Contribution #${idx + 1} - Domain: ${t.domain || 'Math'}]
${t.content || JSON.stringify(t)}
`).join('\n');

        const prompt = `
You are NeuroSyn S1 Proof Consolidator.
Assemble these verified mathematical thoughts into a clean deductive proof graph.

Problem Goal: "${problemContext.goal?.statement || problemContext.naturalText}"
LaTeX: "${problemContext.formalRepresentation?.latex || 'N/A'}"
Feedback Context: "${feedback}"

Contributions:
${thoughtsText}

Respond strictly in JSON:
{
  "conclusion": "Final mathematical conclusion or derived identity",
  "proofSteps": [
    { "step": 1, "statement": "Let G be a finite group...", "justification": "Given assumption" },
    { "step": 2, "statement": "By Lagrange's theorem...", "justification": "Applied Lagrange's Theorem" }
  ],
  "symbolicScript": "# Optional python/sympy verification script\\nimport sympy as sp",
  "leanCode": "theorem proof_target : True := by trivial"
}
`;

        const res = await this.client.chat.completions.create({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.1
        });

        return JSON.parse(res.choices[0].message.content);
    }

    /**
     * Stage 2: Generates audience-targeted explanations across comprehension levels.
     */
    async _stage2_generateExplanations(problemContext, logicalProof, feedback) {
        const prompt = `
You are NeuroSyn S2 Explanation Generator.
Format this formal proof into multi-tier explanations for different audiences.

Problem: "${problemContext.goal?.statement || problemContext.naturalText}"
Logical Steps: ${JSON.stringify(logicalProof.proofSteps)}
Conclusion: "${logicalProof.conclusion}"

Provide JSON with key "explanations":
{
  "researchPaper": "Formal LaTeX publication presentation with precise theorem definitions",
  "undergraduate": "Step-by-step rigorous pedagogical breakdown with rationale for each step",
  "highSchool": "Accessible introduction explaining the core principles clearly",
  "eli5": "Simple intuitive explanation with a real-world visual analogy"
}
`;

        const res = await this.client.chat.completions.create({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.2
        });

        const parsed = JSON.parse(res.choices[0].message.content);
        return parsed.explanations || parsed;
    }

    _handleEmptySynthesis(feedback) {
        return {
            success: false,
            error: 'No thoughts were accepted by the critic for synthesis.',
            feedback,
            explanations: {
                undergraduate: `Unable to produce a verified solution. Critique feedback: ${feedback}`
            }
        };
    }
}