/**
 * @file src/quantix/proofFormats/proofObject.js
 * @description Universal Formal Mathematical Proof Container for NeuroSyn-Math.
 * Encapsulates proof step graphs, Lean 4 code, symbolic scripts, domain classifications,
 * and formal verification certificates.
 */

export class ProofObject {
    /**
     * @param {object} params Initial proof object configuration parameters.
     */
    constructor({
        problem,
        solver = 'NeuroSyn-Math',
        domain = 'Algebra',
        finalAnswer = '',
        solutionCode = '',
        leanCode = '',
        reasoningSummary = '',
        attempt = 1,
        verified = false,
        steps = [],
        confidenceScore = 0.9
    } = {}) {
        if (!problem) {
            throw new Error('[ProofObject] Initializing requires a valid problem statement.');
        }

        this.id = `proof_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.problem = problem;
        this.solver = solver;
        this.domain = domain;
        this.finalAnswer = finalAnswer;
        this.solutionCode = solutionCode;
        this.leanCode = leanCode;
        this.reasoningSummary = reasoningSummary;
        this.attempt = attempt;
        this.verified = verified;
        this.confidenceScore = confidenceScore;

        // Deductive proof steps graph
        this.steps = Array.isArray(steps) ? steps : [];
        this.createdAt = new Date().toISOString();
    }

    /**
     * Adds a structured deductive step to the proof graph.
     */
    addStep({ rule = 'EVALUATE', statement, justification = '', leanTactic = '', dependencies = [] }) {
        const stepNumber = this.steps.length + 1;
        const newStep = {
            step: stepNumber,
            rule,
            statement,
            justification,
            leanTactic,
            dependencies,
            timestamp: new Date().toISOString()
        };
        this.steps.push(newStep);
        return newStep;
    }

    /**
     * Checks if the proof object is formally verified in Lean 4.
     */
    isFullyVerified() {
        return this.verified === true && Boolean(this.leanCode);
    }

    /**
     * Serializes proof object to plain JSON.
     */
    toJSON() {
        return {
            id: this.id,
            problem: this.problem,
            solver: this.solver,
            domain: this.domain,
            finalAnswer: this.finalAnswer,
            solutionCode: this.solutionCode,
            leanCode: this.leanCode,
            reasoningSummary: this.reasoningSummary,
            attempt: this.attempt,
            verified: this.verified,
            confidenceScore: this.confidenceScore,
            steps: this.steps,
            createdAt: this.createdAt
        };
    }

    /**
     * Instantiates a ProofObject from JSON.
     */
    static fromJSON(json) {
        return new ProofObject({
            problem: json.problem,
            solver: json.solver,
            domain: json.domain,
            finalAnswer: json.finalAnswer,
            solutionCode: json.solutionCode,
            leanCode: json.leanCode,
            reasoningSummary: json.reasoningSummary,
            attempt: json.attempt,
            verified: json.verified,
            steps: json.steps,
            confidenceScore: json.confidenceScore
        });
    }
}

export default ProofObject;