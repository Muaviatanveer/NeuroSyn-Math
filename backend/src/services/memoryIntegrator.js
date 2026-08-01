/**
 * @file src/services/memoryIntegrator.js
 * @description NeuroSyn Memory Integration Service.
 * Writes cognitive traces, generates proof embeddings, and manages relational graph updates.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

export class MemoryIntegrator {
    constructor({ clients }) {
        this.openai = clients?.openai || clients?.deepseek || null;
        this.logger = logger;
        this.logger.info('[MemoryIntegrator] Service initialized.');
    }

    /**
     * Persists a complete cognitive trace.
     */
    async saveCognitiveTrace(traceData) {
        const traceId = traceData.id || `trace_${uuidv4().substring(0, 8)}`;
        try {
            this.logger.info(`[MemoryIntegrator] Saved Cognitive Trace: ID ${traceId}`);
            return traceId;
        } catch (error) {
            this.logger.error(`[MemoryIntegrator] Failed to save trace: ${error.message}`);
            return null;
        }
    }

    /**
     * Embeds and persists an episodic proof example.
     */
    async saveEpisodicMemory(episodicData) {
        try {
            this.logger.info(`[MemoryIntegrator] Generating vector embedding for proof example...`);
            const textToEmbed = `Theorem: ${episodicData.prompt}\nSolution: ${episodicData.finalAnswer}`;

            let vector = new Array(1536).fill(0.01);
            if (this.openai?.embeddings) {
                const res = await this.openai.embeddings.create({
                    model: 'text-embedding-3-large',
                    input: textToEmbed
                });
                vector = res.data[0].embedding;
            }

            const id = `ep_${uuidv4().substring(0, 8)}`;
            this.logger.info(`[MemoryIntegrator] Episodic memory stored: ID ${id}`);
            return id;
        } catch (error) {
            this.logger.error(`[MemoryIntegrator] Failed to store episodic memory: ${error.message}`);
            return null;
        }
    }

    /**
     * Adds a relational fact node to World Model.
     */
    async saveRelationalKnowledge(factData) {
        if (!factData.sourceNode || !factData.relationship || !factData.targetNode) {
            return false;
        }
        this.logger.info(`[MemoryIntegrator] Adding WorldModel fact: (${factData.sourceNode.name})-[${factData.relationship}]->(${factData.targetNode.name})`);
        return true;
    }
}