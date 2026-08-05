/**
 * @file src/quantix/memory/cognitiveMirror.js
 * @description NeuroSyn Metacognitive Reflection Engine.
 * Analyzes completed proof traces, extracts reusable mathematical strategy insights,
 * and updates long-term episodic memory.
 */
import logger from '../../utils/logger.js';
import clients, { getModelForRole } from '../../config/clients.js';

export class CognitiveMirror {
    constructor({ logger: appLogger = logger, memory, client, embeddingModel = 'nomic-embed-text:latest' }) {
        if (!memory) {
            throw new Error('[NeuroSyn-Math] CognitiveMirror requires a memory store.');
        }
        this.logger = appLogger;
        this.memory = memory;

        // Dynamic Model Routing for Insight Synthesis
        this.synthesisModel = process.env.LOCAL_MATH_MODEL || process.env.OPENAI_MODEL || 'deepseek-r1:32b';

        if (this.synthesisModel.includes('deepseek') || this.synthesisModel.includes('qwq') || this.synthesisModel.includes('mistral')) {
            this.client = clients.ollama || clients.deepseek || client;
        } else {
            this.client = client || clients.openai;
        }

        this.embeddingModel = process.env.LOCAL_EMBEDDING_MODEL || embeddingModel;
    }

    /**
     * Reflects upon a completed working memory snapshot and persists learned proof insights.
     * @param {object} memorySnapshot Working Memory snapshot object.
     */
    async reflect(memorySnapshot) {
        this.logger.info(`[CognitiveMirror] Reflecting on mathematical trace ID: ${memorySnapshot.processId}`);

        try {
            const percepts = memorySnapshot.global?.percepts || memorySnapshot.global?.parsedProblem || {};
            const successfulAttempt = memorySnapshot.attempts?.[memorySnapshot.attempts.length - 1];

            if (!successfulAttempt) {
                this.logger.warn('[CognitiveMirror] No attempt data found in snapshot for reflection.');
                return;
            }

            const plan = successfulAttempt.state?.plan || successfulAttempt.state?.strategies || [];
            const critique = successfulAttempt.state?.critique || {};
            const finalResponse = successfulAttempt.state?.finalResponse || {};

            // 1. Generate Strategic Mathematical Insight
            const insight = await this._generateMathInsight(percepts, plan, critique, finalResponse);
            this.logger.info(`[CognitiveMirror] Distilled proof insight: "${insight.slice(0, 100)}..."`);

            // 2. Generate Vector Embedding for Math Goal
            const textToEmbed = `${percepts.primaryDomain || 'Math'}: ${percepts.goal?.statement || percepts.naturalText || ''}`;
            const embedding = await this._generateEmbedding(textToEmbed);

            // 3. Persist Insight Object in Episodic Memory
            const insightObject = {
                domain: percepts.primaryDomain || 'Algebra',
                theorem: percepts.goal?.statement || percepts.naturalText,
                latex: percepts.formalRepresentation?.latex || '',
                leanSkeleton: finalResponse.formalProof || finalResponse.leanCode || '',
                embedding,
                insight,
                successfulPlan: plan,
                fullTraceId: memorySnapshot.processId
            };

            await this.memory.add(insightObject);

        } catch (error) {
            this.logger.error(`[CognitiveMirror] Reflection failure: ${error.message}`);
        }
    }

    async _generateMathInsight(percepts, plan, critique, finalResponse) {
        const prompt = `
Extract a general, reusable mathematical proof insight or tactic tip from this successful proof run:

Domain: ${percepts.primaryDomain || 'Algebra'}
Goal: ${percepts.goal?.statement || percepts.naturalText}
Plan Steps: ${JSON.stringify(plan)}

Provide a single, clear mathematical tip or tactic strategy (1-2 sentences). Do not use <think> tags.
Example: "When handling modular congruence proofs for prime powers, apply Euler's totient theorem before modular inversion."
`;

        try {
            const res = await this.client.chat.completions.create({
                model: this.synthesisModel,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            });

            const raw = res.choices[0].message.content;
            return raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        } catch (e) {
            this.logger.warn(`[CognitiveMirror] Insight generation fallback: ${e.message}`);
            return "General mathematical insight derived from successful proof execution.";
        }
    }

    async _generateEmbedding(text) {
        try {
            const response = await this.client.embeddings.create({
                model: this.embeddingModel,
                input: text.replace(/\n/g, ' ')
            });
            return response.data[0].embedding;
        } catch (e) {
            this.logger.warn(`[CognitiveMirror] Embedding fallback generated: ${e.message}`);
            return new Array(1536).fill(0.01);
        }
    }
}