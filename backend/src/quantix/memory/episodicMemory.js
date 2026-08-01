/**
 * @file src/quantix/memory/episodicMemory.js
 * @description NeuroSyn Episodic Memory Store.
 * Long-term persistence for proved mathematical theorems, effective proof strategies, and failure patterns.
 */
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return (normA === 0 || normB === 0) ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export class EpisodicMemory {
    constructor({ path = './quantix_memory.db.json', similarityThreshold = 0.85 } = {}) {
        this.path = path;
        const adapter = new JSONFile(this.path);
        this.db = new Low(adapter, { insights: [] });
        this.logger = logger;
        this.similarityThreshold = similarityThreshold;
        this._init();
    }

    async _init() {
        try {
            await this.db.read();
            this.db.data ||= { insights: [] };
            this.logger.info(`[EpisodicMemory] Loaded ${this.db.data.insights.length} mathematical insights from ${this.path}.`);
        } catch (err) {
            this.logger.warn(`[EpisodicMemory] Initializing new store at ${this.path}`);
            this.db.data = { insights: [] };
            await this.db.write();
        }
    }

    /**
     * Stores a proved mathematical theorem or strategy insight.
     */
    async add(insightObject) {
        await this.db.read();
        const memory = {
            id: `m_${uuidv4().substring(0, 8)}`,
            timestamp: new Date().toISOString(),
            domain: insightObject.domain || 'Algebra',
            theorem: insightObject.theorem || '',
            leanSkeleton: insightObject.leanSkeleton || '',
            strategy: insightObject.strategy || '',
            ...insightObject
        };
        this.db.data.insights.push(memory);
        await this.db.write();
        this.logger.info(`[EpisodicMemory] Stored new theorem insight: ID ${memory.id}`);
    }

    /**
     * Retrieves semantically or domain-relevant past proved theorems and lemmas.
     */
    async retrieveSimilar(embeddingOrDomain, topK = 3) {
        await this.db.read();
        const all = this.db.data.insights || [];
        if (all.length === 0) return [];

        if (typeof embeddingOrDomain === 'string') {
            return all.filter(i => i.domain === embeddingOrDomain || i.theorem?.includes(embeddingOrDomain)).slice(0, topK);
        }

        if (Array.isArray(embeddingOrDomain)) {
            const scored = all.map(item => ({
                ...item,
                similarity: cosineSimilarity(embeddingOrDomain, item.embedding || [])
            }));

            return scored
                .filter(item => item.similarity >= this.similarityThreshold)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK);
        }

        return all.slice(0, topK);
    }
}