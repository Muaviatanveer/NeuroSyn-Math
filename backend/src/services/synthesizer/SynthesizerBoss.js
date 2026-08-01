/**
 * @file src/services/synthesizer/SynthesizerBoss.js
 * @description NeuroSyn Multi-Stage Translation & Synthesis Engine.
 * Manages S1 (Logic), S2 (Balance), and S3 (Precision) pipelines with automated JSON repair.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

async function _callSynthesizerLLM(systemPrompt, userPrompt, clients) {
    const providers = [
        { name: 'anthropic', model: 'claude-haiku-5' },
        { name: 'openai', model: 'gpt-4o' },
        { name: 'deepseek', model: 'deepseek-chat' }
    ];

    for (const { name, model } of providers) {
        const client = clients[name];
        if (client) {
            try {
                if (name === 'anthropic') {
                    const res = await client.messages.create({
                        model,
                        max_tokens: 4096,
                        system: systemPrompt,
                        messages: [{ role: 'user', content: userPrompt }]
                    });
                    return res.content[0].text;
                } else {
                    const res = await client.chat.completions.create({
                        model,
                        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
                    });
                    return res.choices[0].message.content;
                }
            } catch (err) {
                logger.warn(`[SynthesizerBoss] Fallback from ${name}: ${err.message}`);
            }
        }
    }

    throw new Error('[SynthesizerBoss] All configured LLM clients failed.');
}

export class SynthesizerBoss {
    constructor({ clients }) {
        this.name = "TranslationMatrix-Opus";
        this.capabilities = ["synthesis_coordination", "abstract_translation", "final_synthesis_pipeline"];
        this.clients = clients || {};
    }

    /**
     * Synthesizes agent outputs into a structured final response object.
     */
    async think({ agentOutputs = [], researchQuery = '' }) {
        const synthesisId = `syn_${uuidv4().substring(0, 8)}`;
        logger.info(`[SynthesizerBoss] Synthesizing ${agentOutputs.length} agent outputs for query: "${researchQuery.slice(0, 60)}..."`);

        try {
            if (!agentOutputs.length) {
                return { isError: false, finalAnswer: "No agent outputs provided for synthesis.", synthesisId };
            }

            const s1 = await _callSynthesizerLLM(
                "You are S1 Logic Synthesizer. Combine agent outputs into a clear, deduplicated factual report.",
                `Query: ${researchQuery}\nOutputs:\n${agentOutputs.join('\n---\n')}`,
                this.clients
            );

            const s2 = await _callSynthesizerLLM(
                "You are S2 Balance Synthesizer. Enrich the report with context, edge cases, and nuances.",
                `Factual Report:\n${s1}`,
                this.clients
            );

            return {
                isError: false,
                finalAnswer: {
                    query: researchQuery,
                    synthesis: s2,
                    summary: s1.slice(0, 300)
                },
                synthesisId
            };

        } catch (err) {
            logger.error(`[SynthesizerBoss] Pipeline failed: ${err.message}`);
            return { isError: true, error: { message: err.message }, synthesisId };
        }
    }

    /**
     * Translates abstract cognitive substrate results into human-readable preliminary reports.
     */
    async translate({ abstractResult, researchQuery }) {
        try {
            const translated = await _callSynthesizerLLM(
                "Convert this abstract JSON cognitive substrate result into a detailed human-readable report.",
                `Query: ${researchQuery}\nAbstract Substrate Output:\n${JSON.stringify(abstractResult, null, 2)}`,
                this.clients
            );

            return { isError: false, finalAnswer: { report: translated } };
        } catch (err) {
            return { isError: true, error: { message: err.message } };
        }
    }
}