/**
 * @file src/services/thinkerAgents.js
 * @description General-purpose Thinker Agents (AnalyticalThinker, ComprehensiveThinker, 
 * CreativeThinker, DeepSeekThinker, GrokThinker) for NeuroSyn-Math.
 */

import logger from '../utils/logger.js';

function extractContent(response) {
    if (!response) return "[Error: No response object]";
    if (response.choices?.[0]?.message?.content) return response.choices[0].message.content;
    if (response.content?.[0]?.text) return response.content[0].text;
    return typeof response === 'string' ? response : JSON.stringify(response);
}

export class BaseAgent {
    constructor({ name, capabilities = [], clients = {} }) {
        this.name = name;
        this.capabilities = capabilities;
        this.clients = clients;
    }

    getClient(provider) {
        return this.clients[provider] || null;
    }
}

/**
 * AnalyticalThinker Agent
 */
export class AnalyticalThinker extends BaseAgent {
    constructor({ clients }) {
        super({
            name: "AnalyticalThinker",
            capabilities: ["reasoning", "structured_thought", "deductive_reasoning"],
            clients
        });
        this.openai = this.getClient('openai') || this.getClient('deepseek');
    }

    async think({ prompt, context = '' }) {
        logger.info(`[${this.name}] Executing reasoning on prompt: "${prompt.slice(0, 80)}..."`);
        const systemPrompt = `You are the Analytical Thinker agent in NeuroSyn-Math. Provide clear, logical analysis using LaTeX for equations.`;
        const userPrompt = `Context:\n${context}\n\nPrompt:\n${prompt}`;

        try {
            const client = this.openai || this.clients.openai;
            const res = await client.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                temperature: 0.1
            });
            return { agent: this.name, content: extractContent(res) };
        } catch (err) {
            logger.error(`[${this.name}] Failed: ${err.message}`);
            return { agent: this.name, content: null, error: err.message };
        }
    }
}

/**
 * ComprehensiveThinker Agent
 */
export class ComprehensiveThinker extends BaseAgent {
    constructor({ clients }) {
        super({
            name: "ComprehensiveThinker",
            capabilities: ["exhaustive_search", "synthesis", "literature_review"],
            clients
        });
    }

    async think({ prompt, context = '' }) {
        logger.info(`[${this.name}] Performing comprehensive synthesis...`);
        const client = this.getClient('openai') || this.getClient('deepseek');
        const res = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are an exhaustive research synthesizer.' },
                { role: 'user', content: `Context:\n${context}\n\nPrompt:\n${prompt}` }
            ],
            temperature: 0.2
        });
        return { agent: this.name, content: extractContent(res) };
    }
}

/**
 * CreativeThinker Agent
 */
export class CreativeThinker extends BaseAgent {
    constructor({ clients }) {
        super({
            name: "CreativeThinker",
            capabilities: ["creative_ideation", "synthesis", "metaphorical_reasoning"],
            clients
        });
    }

    async think({ prompt, context = '' }) {
        const userPrompt = `Context:\n${context}\n\nPrompt:\n${prompt}`;

        try {
            const anthropic = this.getClient('anthropic');
            if (anthropic) {
                const res = await anthropic.messages.create({
                    model: 'claude-haiku-5',
                    max_tokens: 2048,
                    messages: [{ role: 'user', content: userPrompt }]
                });
                return { agent: this.name, content: extractContent(res) };
            }
        } catch (e) {
            logger.warn(`[${this.name}] Anthropic fallback to OpenAI: ${e.message}`);
        }

        const client = this.getClient('openai') || this.getClient('deepseek');
        const res = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0.8
        });
        return { agent: this.name, content: extractContent(res) };
    }
}

/**
 * DeepSeekThinker Agent
 */
export class DeepSeekThinker extends BaseAgent {
    constructor({ clients }) {
        super({
            name: "DeepSeekThinker",
            capabilities: ["reasoning", "logical_analysis", "formal_proof"],
            clients
        });
    }

    async think({ prompt, context = '' }) {
        const client = this.getClient('deepseek') || this.getClient('openai');
        const res = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: `Context:\n${context}\n\nPrompt:\n${prompt}` }]
        });
        return { agent: this.name, content: extractContent(res) };
    }
}

/**
 * GrokThinker Agent
 */
export class GrokThinker extends BaseAgent {
    constructor({ clients }) {
        super({
            name: "GrokThinker",
            capabilities: ["real_time_knowledge", "contrarian_perspective"],
            clients
        });
    }

    async think({ prompt, context = '' }) {
        const client = this.getClient('xai') || this.getClient('openai');
        const res = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: `Context:\n${context}\n\nPrompt:\n${prompt}` }]
        });
        return { agent: this.name, content: extractContent(res) };
    }
}