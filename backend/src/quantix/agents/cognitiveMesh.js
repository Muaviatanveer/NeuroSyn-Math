/**
 * @file src/quantix/agents/cognitiveMesh.js
 * @description NeuroSyn Parallel Specialist Dispatcher with Tool Execution.
 */

import logger from '../../utils/logger.js';
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

        if (!primaryClient) {
            throw new Error('[CognitiveMesh] Requires an active LLM client.');
        }

        const cfg = { client: primaryClient, logger: this.logger };

        this.specialists.set('Algebra', new AlgebraAgent(cfg));
        this.specialists.set('Geometry', new GeometryAgent(cfg));
        this.specialists.set('Number Theory', new NumberTheoryAgent(cfg));
        this.specialists.set('Combinatorics', new CombinatoricsAgent(cfg));
        this.specialists.set('Analysis', new AnalysisAgent(cfg));
        this.specialists.set('Logic', new LogicAgent(cfg));

        this.logger.info(`[CognitiveMesh] Initialized ${this.specialists.size} Active Tool-Executing Domain Specialists.`);
    }

    async execute(task, context, options = {}) {
        const targetDomains = options.domains || [context?.problem?.primaryDomain || 'Algebra'];
        this.logger.info(`[CognitiveMesh] Dispatching task to domain specialists: [${targetDomains.join(', ')}]...`);

        const selectedAgents = [];
        targetDomains.forEach(domain => {
            if (this.specialists.has(domain)) {
                selectedAgents.push(this.specialists.get(domain));
            }
        });

        if (selectedAgents.length === 0) {
            selectedAgents.push(this.specialists.get('Logic'));
        }

        const promises = selectedAgents.map(async (agent) => {
            try {
                const result = await agent.think(task, context);
                return result;
            } catch (err) {
                this.logger.error(`[CognitiveMesh] Specialist ${agent.name} failed: ${err.message}`);
                return null;
            }
        });

        const thoughts = await Promise.all(promises);
        return thoughts.filter(t => t !== null);
    }
}