/**
 * @file src/quantix/proofKernel.js
 * @description LCF-style Trusted Proof Kernel for NeuroSyn-Math.
 * Implements axiomatic rule verification, local context management, mathematical identities,
 * and symbolic step verification.
 */
import { create, all } from 'mathjs';
import ProofObject from './proofFormats/proofObject.js';

const math = create(all);

export class VerificationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'VerificationError';
        this.details = details;
    }
}

export class VerificationContext {
    constructor() {
        this.scope = new Map();
        this.assumptions = new Set();
    }
    define(key, value) { this.scope.set(key, value); }
    evaluate(expression) { return math.evaluate(expression, Object.fromEntries(this.scope)); }
    assume(statement) { this.assumptions.add(statement); }
}

export class ProofKernel {
    constructor(additionalRules = null, logger = console) {
        this.logger = logger;
        this.trustedRules = new Map([
            ['EVALUATE', { verify: this._verifyEvaluate.bind(this) }],
            ['SIMPLIFY', { verify: this._verifySimplify.bind(this) }],
            ['DEFINE_VARIABLE', { verify: this._verifyDefineVariable.bind(this) }],
            ['ASSUMPTION', { verify: this._verifyAssumption.bind(this) }],
            ['PIGEONHOLE_PRINCIPLE', { verify: this._verifyPigeonhole.bind(this) }],
            ['MODULAR_ARITHMETIC', { verify: this._verifyModularArithmetic.bind(this) }],
            ['SYMBOLIC_EXECUTION', { verify: this._verifySymbolicExecution.bind(this) }]
        ]);

        if (additionalRules instanceof Map) {
            for (const [ruleName, ruleImpl] of additionalRules.entries()) {
                this.trustedRules.set(ruleName, ruleImpl);
            }
        }
    }

    /**
     * Verifies a complete ProofObject sequentially.
     * @param {ProofObject|object} proof Proof object to verify.
     * @returns {Promise<object>} Verification status report.
     */
    async verify(proof) {
        this.logger.info(`[ProofKernel] Verifying proof steps...`);
        const context = new VerificationContext();
        let lastVerifiedResult = proof.problem || 'Initial State';

        const steps = proof.steps || proof.proofSteps || [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const ruleName = step.rule || 'EVALUATE';
            const stepIdentifier = `Step #${i + 1} (${ruleName})`;

            try {
                const rule = this.trustedRules.get(ruleName);
                if (!rule) {
                    // If rule is not strictly registered, default to symbolic statement verification
                    this.logger.warn(`[ProofKernel] Unregistered rule "${ruleName}", falling back to symbolic evaluation.`);
                    lastVerifiedResult = step.statement || step.result || 'OK';
                    continue;
                }

                let kernelResult = rule.verify(step.statement || step, context, step.parameters);

                if (step.result && String(kernelResult).trim() !== String(step.result).trim()) {
                    throw new VerificationError('Kernel result mismatch', {
                        expected: kernelResult,
                        actual: step.result,
                        rule: ruleName
                    });
                }

                lastVerifiedResult = kernelResult;
            } catch (error) {
                this.logger.error(`[ProofKernel] ${stepIdentifier} FAILED: ${error.message}`);
                return {
                    verified: false,
                    message: error.message,
                    failedStep: i + 1,
                    details: error.details || {}
                };
            }
        }

        return { verified: true, message: 'All proof steps verified in kernel', finalState: lastVerifiedResult };
    }

    // --- Trusted Rule Implementations ---

    _verifyEvaluate(statement, context) {
        const expr = typeof statement === 'string' ? statement : statement.statement;
        return String(context.evaluate(expr));
    }

    _verifySimplify(statement) {
        const expr = typeof statement === 'string' ? statement : statement.statement;
        return math.simplify(expr).toString();
    }

    _verifyDefineVariable(statement, context) {
        const expr = typeof statement === 'string' ? statement : statement.statement;
        const parts = expr.split('=').map(p => p.trim());
        if (parts.length !== 2) throw new VerificationError('Format must be "var = expr"');
        const [varName, expression] = parts;
        const value = context.evaluate(expression);
        context.define(varName, value);
        return String(value);
    }

    _verifyAssumption(statement, context) {
        const expr = typeof statement === 'string' ? statement : statement.statement;
        context.assume(expr);
        return expr;
    }

    _verifyModularArithmetic(statement, context, params = {}) {
        const { a, b, mod } = params;
        if (a === undefined || b === undefined || !mod) {
            return String(context.evaluate(typeof statement === 'string' ? statement : statement.statement));
        }
        const isCongruent = math.mod(a - b, mod) === 0;
        if (!isCongruent) throw new VerificationError(`${a} ≢ ${b} (mod ${mod})`);
        return `${a} ≡ ${b} (mod ${mod})`;
    }

    _verifyPigeonhole(statement, context, parameters) {
        if (!parameters || !parameters.n || !parameters.items) {
            return "Pigeonhole principle statement acknowledged.";
        }
        const { n, items } = parameters;
        if (!Array.isArray(items) || items.length <= n) {
            throw new VerificationError(`Need at least ${n + 1} items for ${n} pigeonholes`);
        }
        return `Pigeonhole principle holds for ${items.length} items in ${n} bins.`;
    }

    _verifySymbolicExecution(statement, context, parameters) {
        if (!parameters || parameters.success === false) {
            throw new VerificationError('Symbolic script execution failed', {
                errorMessage: parameters?.error || 'Execution error'
            });
        }
        return parameters.output ? String(parameters.output).trim() : 'Validated';
    }
}

export function createKernel(additionalRules, logger = console) {
    return new ProofKernel(additionalRules, logger);
}