/**
 * @file src/quantix/agents/cognitiveMesh.js
 * @description NeuroSyn Parallel Specialist Dispatcher with Timeout Safety & Model Routing.
 */

import logger from '../../utils/logger.js';
import { getModelForRole } from '../../config/clients.js';
import { AlgebraAgent } from './specialists/AlgebraAgent.js';
import { GeometryAgent } from './specialists/GeometryAgent.js';
import { NumberTheoryAgent } from './specialists/NumberTheoryAgent.js';
import { CombinatoricsAgent } from './specialists/CombinatoricsAgent.js';
import { AnalysisAgent } from './specialists/AnalysisAgent.js';
import { LogicAgent } from './specialists/LogicAgent.js';

const AGENT_TIMEOUT_MS = 50000; // ⚡ Increased to 50s hard limit for local 32B models

export class CognitiveMesh {
    constructor({ clients, logger: appLogger = logger }) {
        this.logger = appLogger;
        this.clients = clients;
        this.specialists = new Map();

        this._initializeSpecialists();
    }

    _initializeSpecialists() {
        const primaryClient = this.clients.openai || this.clients.deepseek || this.clients.anthropic;
        // ⚡ FIX: Explicitly bind specialists to local reasoning model (deepseek-r1:32b) instead of gpt-4o
        const mathModel = getModelForRole('math_reasoning');

        if (!primaryClient) {
            throw new Error('[CognitiveMesh] Requires an active LLM client.');
        }

        const cfg = { client: primaryClient, logger: this.logger, modelName: mathModel };

        this.specialists.set('Algebra', new AlgebraAgent(cfg));
        this.specialists.set('Geometry', new GeometryAgent(cfg));
        this.specialists.set('Number Theory', new NumberTheoryAgent(cfg));
        this.specialists.set('Combinatorics', new CombinatoricsAgent(cfg));
        this.specialists.set('Analysis', new AnalysisAgent(cfg));
        this.specialists.set('Logic', new LogicAgent(cfg));

        this.logger.info(`[CognitiveMesh] Initialized ${this.specialists.size} Tool Specialists on model "${mathModel}".`);
    }

    async execute(task, context, options = {}) {
        const targetDomains = options.domains || [context?.problem?.primaryDomain || 'Algebra'];
        
        // ⚡ OPTIMIZATION FOR LOCAL VRAM: 
        // Focus VRAM compute on the Primary Domain Specialist to avoid GPU context-switching delays
        const primaryDomain = targetDomains[0] || 'Algebra';
        this.logger.info(`[CognitiveMesh] Dispatching primary task to domain specialist: [${primaryDomain}]...`);

        const agent = this.specialists.get(primaryDomain) || this.specialists.get('Logic');

        try {
            const result = await this._execWithTimeout(agent.think(task, context), AGENT_TIMEOUT_MS, agent.name);
            return result ? [result] : [];
        } catch (err) {
            this.logger.error(`[CognitiveMesh] Specialist ${agent.name} failed: ${err.message}`);
            return [];
        }
    }

    _execWithTimeout(promise, timeoutMs, agentName) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Specialist ${agentName} timed out after ${timeoutMs / 1000}s`));
            }, timeoutMs);

            promise
                .then(res => { clearTimeout(timer); resolve(res); })
                .catch(err => { clearTimeout(timer); reject(err); });
        });
    }
}