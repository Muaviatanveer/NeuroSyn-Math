/**
 * @file src/quantix/agents/cognitiveMesh.js
 * @description NeuroSyn Parallel Specialist Dispatcher (Uncapped Timeout for Local 32B Models).
 */

import logger from '../../utils/logger.js';
import { getModelForRole } from '../../config/clients.js';
import { AlgebraAgent } from './specialists/AlgebraAgent.js';
import { GeometryAgent } from './specialists/GeometryAgent.js';
import { NumberTheoryAgent } from './specialists/NumberTheoryAgent.js';
import { CombinatoricsAgent } from './specialists/CombinatoricsAgent.js';
import { AnalysisAgent } from './specialists/AnalysisAgent.js';
import { LogicAgent } from './specialists/LogicAgent.js';

export class CognitiveMesh {
    constructor({ clients, logger: appLogger = logger }) {
        this.logger = appLogger;
        this.clients = clients;
        this.specialists = new Map();

        this._initializeSpecialists();
    }

    _initializeSpecialists() {
        const primaryClient = this.clients.openai || this.clients.deepseek || this.clients.anthropic;
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
        const stream = options.stream || (() => {}); // ⚡ Extract stream callback
        
        // Focus VRAM compute on Primary Domain Specialist
        const primaryDomain = targetDomains[0] || 'Algebra';
        this.logger.info(`[CognitiveMesh] Dispatching primary task to domain specialist: [${primaryDomain}]...`);

        const agent = this.specialists.get(primaryDomain) || this.specialists.get('Logic');

        try {
            // ⚡ Pass stream down to agent.think()
            const result = await agent.think(task, context, stream);
            return result ? [result] : [];
        } catch (err) {
            this.logger.error(`[CognitiveMesh] Specialist ${agent.name} failed: ${err.message}`);
            return [];
        }
    }
}