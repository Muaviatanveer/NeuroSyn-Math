/**
 * @file src/services/emotionEngine++.js
 * @description NeuroSyn Intent Analysis Engine.
 * Analyzes mathematical, computational, and technical prompts to compute strategy vectors and urgency metrics.
 */

import logger from '../utils/logger.js';

const MATH_KEYWORDS = [
    'prove', 'theorem', 'lemma', 'algebra', 'calculus', 'group theory', 'number theory',
    'combinatorics', 'geometry', 'inequality', 'solve for', 'lean 4', 'counterexample'
];

export class EmotionEnginePlusPlus {
    constructor({ clients }) {
        this.name = "EmotionEngine++";
        this.capabilities = ["emotion_detection", "intent_analysis", "multimodal_parsing"];
        this.clients = clients || {};
    }

    getClient(provider) {
        return this.clients[provider] || null;
    }

    /**
     * Evaluates prompt intent and generates strategy vectors.
     */
    async think(input) {
        let prompt = typeof input === 'string' ? input : (input?.prompt || '');
        if (!prompt) return this.getTechnicalBypassState();

        const lower = prompt.toLowerCase();
        const isMathTask = MATH_KEYWORDS.some(kw => lower.includes(kw));

        if (isMathTask) {
            logger.info(`[EmotionEngine++] Mathematical reasoning task detected.`);
            return {
                vector: { analytical: 0.95, creative: 0.3, formal: 0.9, meticulous: 0.95 },
                urgency: 0.2,
                ethical_considerations: [],
                strategy_suggestions: ['use_powerful_model', 'formal_verification'],
                task_type: 'Computational_Execution',
                prompt
            };
        }

        const systemPrompt = `
Analyze the user prompt and generate an intent map strictly in JSON:
{
  "vector": { "analytical": 0.8, "creative": 0.2, "formal": 0.7, "meticulous": 0.8 },
  "urgency": 0.2,
  "ethical_considerations": [],
  "strategy_suggestions": ["use_powerful_model"],
  "task_type": "Knowledge_Synthesis"
}
`;

        try {
            const client = this.getClient('openai') || this.getClient('deepseek');
            if (!client) return this.getTechnicalBypassState();

            const { getModelForRole } = await import('../config/clients.js');
            
            const response = await client.chat.completions.create({
                model: getModelForRole('emotion_engine'),
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Prompt: "${prompt}"` }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1
            });

            let rawContent = response.choices[0].message.content || '';
            let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
            
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start !== -1 && end !== -1 && start <= end) {
                cleaned = cleaned.substring(start, end + 1);
            }
            
            const parsed = JSON.parse(cleaned);
            return { ...parsed, prompt };
        } catch (e) {
            logger.warn(`[EmotionEngine++] Fallback state returned: ${e.message}`);
            return { ...this.getTechnicalBypassState(), prompt };
        }
    }

    getTechnicalBypassState() {
        return {
            vector: { analytical: 0.9, creative: 0.2, formal: 0.8, meticulous: 0.9 },
            urgency: 0.1,
            ethical_considerations: [],
            strategy_suggestions: ['use_powerful_model'],
            task_type: 'Computational_Execution'
        };
    }
}