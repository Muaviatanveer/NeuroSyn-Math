/**
 * @file src/quantix/solvers/index.js
 * @description Centralized Factory & Registry for NeuroSyn-Math Solvers.
 * Manages instances of GptSolver, DeepseekSolver, and specialized Verification Solvers.
 */
import { GptSolver } from './gptSolver.js';
import { DeepseekSolver } from './deepseekSolver.js';
import logger from '../../utils/logger.js';

function registerSolver(solversMap, solverName, SolverClass, client, baseConfig, specificConfig = {}) {
    const log = baseConfig.logger || logger;
    const modelName = specificConfig.modelName || solverName;

    if (client) {
        solversMap.set(solverName, new SolverClass({
            client,
            ...baseConfig,
            ...specificConfig,
            modelName
        }));
        log.info(`[SolverFactory] ✅ Registered solver: "${solverName}" (Model: "${modelName}")`);
    } else {
        log.warn(`[SolverFactory] ⚠️ Skipping "${solverName}" - API client not configured.`);
    }
}

export const quantixSolvers = {
    /**
     * Instantiates and returns a Map of configured solvers.
     * @param {object} params Clients and logger instances.
     * @returns {Map<string, object>} Map of solver instances keyed by name.
     */
    getSolvers({ clients, logger: appLogger = logger }) {
        if (!clients) {
            throw new Error('[SolverFactory] getSolvers requires initialized clients.');
        }

        const solvers = new Map();
        const baseConfig = { logger: appLogger };

        const openaiModel = process.env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'deepseek-r1:32b';
        const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

        // 1. Primary Neural Solvers
        registerSolver(solvers, 'gpt-math', GptSolver, clients.openai, baseConfig, { modelName: openaiModel });
        registerSolver(solvers, 'deepseek-math', DeepseekSolver, clients.deepseek || clients.openai, baseConfig, { modelName: deepseekModel });

        // 2. Dedicated Mathematical Verifier Solver Instance
        registerSolver(solvers, 'verifier-gpt', GptSolver, clients.openai, baseConfig, {
            modelName: openaiModel,
            systemPrompt: `You are an elite mathematics professor and verifier for NeuroSyn-Math. Your sole duty is to inspect candidate proof steps for logical gaps, unproven assumptions, and boundary failures.`
        });

        return solvers;
    },

    /**
     * Helper to retrieve the primary solver for a given mathematical domain.
     */
    getPrimarySolver(solvers, domain = 'Algebra') {
        if (solvers.has('deepseek-math')) return solvers.get('deepseek-math');
        if (solvers.has('gpt-math')) return solvers.get('gpt-math');
        return solvers.values().next().value || null;
    }
};