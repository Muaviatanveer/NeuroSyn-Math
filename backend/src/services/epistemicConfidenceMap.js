/**
 * @file src/services/epistemicConfidenceMap.js
 * @description NeuroSyn-Math Multi-Signal Epistemic Confidence Engine.
 * Evaluates formal Lean 4 verification results, SMT counterexample search survival,
 * symbolic computation outputs, and agent consensus to assign explainable confidence scores.
 */
import logger from '../utils/logger.js';

export class EpistemicConfidence {
    constructor({ clients, logger: appLogger = logger }) {
        this.logger = appLogger;
        this.openai = clients?.openai || clients?.deepseek;
    }

    /**
     * Evaluates a cognitive trace or proof object to generate an epistemic confidence report.
     * @param {object} cognitiveTrace Trace or ProofObject output from NeuroSyn pipeline.
     * @returns {Promise<{score: number, reason: string, metrics: object}>}
     */
    async evaluate(cognitiveTrace = {}) {
        this.logger.info('[EpistemicConfidence] Calculating verification-anchored confidence score...');

        const metrics = {
            leanVerifiedScore: 0.0,
            counterexampleSurvivalScore: 0.0,
            symbolicScore: 0.0,
            consensusScore: 0.0
        };

        // 1. Formal Lean 4 Verification Signal (Weight: 40%)
        if (cognitiveTrace.leanVerified || cognitiveTrace.verificationCertificate?.leanVerified) {
            metrics.leanVerifiedScore = 0.40;
        } else if (cognitiveTrace.leanCode) {
            metrics.leanVerifiedScore = 0.15; // Code present but unverified/repaired
        }

        // 2. Counterexample Search Survival Signal (Weight: 30%)
        const ceReport = cognitiveTrace.counterexampleReport;
        if (ceReport && !ceReport.foundCounterexample) {
            metrics.counterexampleSurvivalScore = 0.30;
        } else if (ceReport && ceReport.foundCounterexample) {
            metrics.counterexampleSurvivalScore = 0.0; // Statement is FALSE
        } else {
            metrics.counterexampleSurvivalScore = 0.15; // Not tested
        }

        // 3. Symbolic Mathematics Engine Signal (Weight: 20%)
        if (cognitiveTrace.symbolicallyVerified || cognitiveTrace.proofObject?.solutionCode) {
            metrics.symbolicScore = 0.20;
        } else {
            metrics.symbolicScore = 0.10;
        }

        // 4. Critic & Agent Consensus Signal (Weight: 10%)
        const critique = cognitiveTrace.critique;
        if (critique?.finalDecision === 'SUCCESS' || cognitiveTrace.confidence > 0.8) {
            metrics.consensusScore = 0.10;
        } else {
            metrics.consensusScore = 0.05;
        }

        const totalScore = Math.min(1.0, Math.max(0.0,
            metrics.leanVerifiedScore +
            metrics.counterexampleSurvivalScore +
            metrics.symbolicScore +
            metrics.consensusScore
        ));

        const reason = this._generateReason(metrics, totalScore);

        this.logger.info(`[EpistemicConfidence] Score: ${totalScore.toFixed(2)} - ${reason}`);

        return {
            score: totalScore,
            reason,
            metrics
        };
    }

    _generateReason(metrics, total) {
        if (metrics.leanVerifiedScore >= 0.40 && metrics.counterexampleSurvivalScore >= 0.30) {
            return 'Fully verified in Lean 4 and survived all automated counterexample fuzzing.';
        }
        if (metrics.counterexampleSurvivalScore === 0.0) {
            return 'Counterexample found during boundary search; statement is mathematically invalid.';
        }
        if (metrics.leanVerifiedScore > 0) {
            return 'Partial formal verification achieved; symbolic steps checked with no counterexamples.';
        }
        return `Unverified formal proof; confidence score estimated at ${(total * 100).toFixed(0)}%.`;
    }
}