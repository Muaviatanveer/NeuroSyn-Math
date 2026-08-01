/**
 * @file backend/src/config/clients.js
 * @description Centralized AI Client & Model Router for NeuroSyn-Math.
 * Fixes cloud API vs local Ollama model routing.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';

export const MODELS = {
    get LOCAL_MATH_REASONER() { return process.env.LOCAL_MATH_MODEL || 'deepseek-r1:32b'; },
    get LOCAL_CODE_SPECIALIST() { return process.env.LOCAL_CODE_MODEL || 'qwen2.5-coder:32b'; },
    get LOCAL_EMBEDDINGS() { return process.env.LOCAL_EMBEDDING_MODEL || 'nomic-embed-text:latest'; },
    get OPENAI_GPT4O() { return process.env.OPENAI_MODEL || 'gpt-4o'; },
    get DEEPSEEK_CLOUD_REASONER() { return process.env.DEEPSEEK_MODEL || 'deepseek-chat'; }
};

class ClientRegistry {
    get clientBaseUrl() {
        return process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    }

    getClients() {
        const baseUrl = this.clientBaseUrl;
        const clients = {};

        // 1. Ollama / Colab Client with Ngrok Bypass Header
        clients.ollama = new OpenAI({
            apiKey: 'ollama-local',
            baseURL: baseUrl,
            defaultHeaders: {
                'ngrok-skip-browser-warning': 'true',
                'User-Agent': 'NeuroSyn-Math-Client'
            }
        });

        // 2. OpenAI Client (Cloud API)
        if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your_')) {
            clients.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        } else {
            clients.openai = clients.ollama;
        }

        // 3. DeepSeek Client (Uses Colab Ollama or Cloud DeepSeek)
        if (process.env.USE_LOCAL_DEEPSEEK === 'true' || !process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes('your_')) {
            clients.deepseek = clients.ollama;
        } else {
            clients.deepseek = new OpenAI({
                apiKey: process.env.DEEPSEEK_API_KEY,
                baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
            });
        }

        // 4. Anthropic Client
        if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes('your_')) {
            clients.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }

        return clients;
    }

    getModelForRole(role) {
        switch (role) {
            case 'math_reasoning':
                return process.env.USE_LOCAL_DEEPSEEK === 'true' ? MODELS.LOCAL_MATH_REASONER : MODELS.DEEPSEEK_CLOUD_REASONER;
            case 'code_synthesis':
                return process.env.USE_LOCAL_CODE === 'true' ? MODELS.LOCAL_CODE_SPECIALIST : MODELS.OPENAI_GPT4O;
            case 'embeddings':
                return process.env.USE_LOCAL_EMBEDDINGS === 'true' ? MODELS.LOCAL_EMBEDDINGS : 'text-embedding-3-large';
            default:
                return MODELS.OPENAI_GPT4O;
        }
    }
}

const registryInstance = new ClientRegistry();
export const clients = new Proxy({}, {
    get(target, prop) {
        return registryInstance.getClients()[prop];
    }
});
export const getModelForRole = (role) => registryInstance.getModelForRole(role);
export default clients;