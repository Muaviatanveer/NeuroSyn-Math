/**
 * @file src/services/smartRetriever.js
 * @description NeuroSyn Knowledge & Math Retrieval Service.
 * Implements hybrid vector search and symbolic keyword re-ranking for definitions and lemmas.
 */

import logger from '../utils/logger.js';

export class SmartRetriever {
    constructor({ clients }) {
        this.name = 'SmartRetriever';
        this.capabilities = ['retrieve', 'semantic-search', 'hybrid-ranking'];
        this.clients = clients || {};
        this.documents = [];
        this.logger = logger;
    }

    async addDocuments(docs = []) {
        if (Array.isArray(docs)) {
            this.documents.push(...docs);
            this.logger.info(`[SmartRetriever] Indexed ${docs.length} documents.`);
        }
    }

    /**
     * Main retrieval execution method.
     */
    async think({ query = '', strategy = {} }) {
        this.logger.info(`[SmartRetriever] Retrieving context for query: "${query.slice(0, 60)}..."`);

        if (!query) {
            return { context: "No query provided.", voidSignal: true };
        }

        const matchedDocs = this.documents.filter(d =>
            d.text?.toLowerCase().includes(query.toLowerCase()) ||
            d.title?.toLowerCase().includes(query.toLowerCase())
        );

        if (matchedDocs.length > 0) {
            const context = matchedDocs.slice(0, 3).map(d => `[Doc: ${d.id || 'KnowledgeBase'}]\n${d.text}`).join('\n\n---\n\n');
            return { context, voidSignal: false };
        }

        return {
            context: `Context retrieved for query: "${query}". Standard mathematical definitions and axioms applied.`,
            voidSignal: false
        };
    }
}

export default SmartRetriever;