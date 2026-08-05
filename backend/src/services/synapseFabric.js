/**
 * @file src/services/synapseFabric.js
 * @description Pinnacle Nexus Core (SynapseFabric v2025). High-level routing fabric 
 * that integrates NeuroSyn-Math, Parallel Realities Architecture (PRA), and Cognitive Cycles.
 */

import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';
import clients from '../config/clients.js';

import logger from '../utils/logger.js';
import { EmotionEnginePlusPlus } from './emotionEngine++.js';
import { NeuroPlanner } from '../quantix/meta/neuroPlanner.js';
import { MultiCriticPanel } from '../quantix/critics/multiCriticPanel.js';
import { EpistemicConfidence } from './epistemicConfidenceMap.js';
import { MemoryIntegrator } from './memoryIntegrator.js';
import { SynthesizerBoss } from './synthesizer/SynthesizerBoss.js';
import { SmartRetriever } from './smartRetriever.js';
import { QuantumVerifier } from './quantumVerifier.js';
import AgentRegistry from './agentRegistry.js';

// NeuroSyn-Math Orchestrator Import
import { NeuroSynMathOrchestrator } from '../quantix/orchestrator.js';

import { AnalyticalThinker, CreativeThinker, ComprehensiveThinker } from './thinkerAgents.js';
import { EthicsCriticAgent } from './agents/ethicsCritic/EthicsCriticAgent.js';

class HaystackResearcher {
    constructor({ clients }) {
        this.clients = clients;
        this.name = "HaystackResearcher";
    }

    async think({ prompt, context = '', strategy = {} }, stream) {
        const systemPrompt = `You are Haystack Researcher specializing in deep information retrieval. Strategy: ${JSON.stringify(strategy)}`;
        try {
            const response = await this.clients.deepseek.chat.completions.create({
                model: "deepseek-chat",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Context:\n${context}\n\nPrompt:\n${prompt}` }],
                temperature: strategy.temperature ?? 0.5,
                stream: true
            });
            let fullText = '';
            for await (const chunk of response) {
                const token = chunk.choices[0]?.delta?.content || '';
                fullText += token;
                if (token && typeof stream === 'function') {
                    stream('token', { agent: this.name, token });
                }
            }
            return { agent: this.name, content: fullText };
        } catch (error) {
            return { agent: this.name, content: null, error: error.message };
        }
    }
}

class SynapseFabric {
    static CONFIG = {
        IS_COE_MODE: process.env.NODE_ENV === 'production',
        STRATEGY_FAST_PATH: 'STRATEGY_FAST_PATH',
        STRATEGY_DEEP_CYCLE: 'STRATEGY_DEEP_CYCLE',
        STRATEGY_PRA: 'STRATEGY_PRA',
        STRATEGY_METACOGNITIVE_FORGING: 'STRATEGY_METACOGNITIVE_FORGING',
        STRATEGY_NEUROSYN_MATH: 'STRATEGY_NEUROSYN_MATH'
    };

    constructor() {
        // Use centralized client registry
        this.clients = clients;

        this._createAndRegisterAgents();
        this._initializeCoreServices();
        logger.info('✅ Pinnacle Nexus Core (SynapseFabric v2025 + NeuroSyn-Math) Online.');
    }

    _createAndRegisterAgents() {
        const agentsToRegister = [
            { name: "AnalyticalThinker", instance: new AnalyticalThinker({ clients: this.clients }) },
            { name: "ComprehensiveThinker", instance: new ComprehensiveThinker({ clients: this.clients }) },
            { name: "CreativeThinker", instance: new CreativeThinker({ clients: this.clients }) },
            { name: "EthicsCriticAgent", instance: new EthicsCriticAgent({ clients: this.clients }) },
            { name: "HaystackResearcher", instance: new HaystackResearcher({ clients: this.clients }) },
        ];
        agentsToRegister.forEach(a => AgentRegistry.register(a.name, a.instance));
    }

    _initializeCoreServices() {
        this.emotionEngine = new EmotionEnginePlusPlus({ clients: this.clients });
        this.planner = new NeuroPlanner({ clients: this.clients });
        this.retriever = new SmartRetriever({ clients: this.clients });
        this.synthBoss = new SynthesizerBoss({ clients: this.clients });
        this.critic = new MultiCriticPanel({ clients: this.clients });
        this.confidence = new EpistemicConfidence({ clients: this.clients });
        this.memory = new MemoryIntegrator({ clients: this.clients, useHierarchicalMemory: true });
        this.verifier = new QuantumVerifier({ clients: this.clients });

        // NeuroSyn-Math Verification-First Engine
        this.neuroSynMath = new NeuroSynMathOrchestrator({ clients: this.clients });
    }

    async processPrompt(prompt, { sendStreamData = () => { }, userId, context = null }) {
        const trace = {
            id: uuidv4(),
            userId,
            prompt,
            startTime: performance.now(),
            steps: []
        };

        this._sendStatus(sendStreamData, 'Initializing Nexus Core...', trace.id);

        try {
            const intentVector = await this.emotionEngine.think({ prompt });
            trace.intentVector = intentVector;

            const strategy = this._selectCognitiveStrategy({ ...intentVector, prompt });
            trace.selectedStrategy = strategy;
            this._sendStatus(sendStreamData, `Strategy selected: ${strategy}`, trace.id);

            let result;
            switch (strategy) {
                case SynapseFabric.CONFIG.STRATEGY_NEUROSYN_MATH:
                    result = await this.neuroSynMath.process(prompt, sendStreamData);
                    break;
                case SynapseFabric.CONFIG.STRATEGY_FAST_PATH:
                    result = await this._executeFastPath({ prompt, trace, sendStreamData });
                    break;
                default:
                    result = await this.neuroSynMath.process(prompt, sendStreamData);
            }

            trace.finalResponse = result.explanation?.undergraduate || result.finalResponse || JSON.stringify(result);
            trace.durationMs = performance.now() - trace.startTime;
            sendStreamData('end', { message: 'Stream finished.', traceId: trace.id });

            await this.memory.saveCognitiveTrace(trace);
            return result;

        } catch (error) {
            logger.error(`[Nexus Core] Critical failure: ${error.message}`, { traceId: trace.id });
            sendStreamData('error', { message: error.message });
            throw error;
        }
    }

    _selectCognitiveStrategy(intentVector) {
        const prompt = (intentVector.prompt || '').toLowerCase();

        // Comprehensive mathematical & Olympiad keywords
        const mathKeywords = [
            'prove', 'theorem', 'lemma', 'lean 4', 'algebra', 'calculus', 'group theory',
            'number theory', 'combinatorics', 'geometry', 'inequality', 'solve for',
            'show that', 'equation', 'counterexample', 'diophantine', 'determine all',
            'find all', 'positive integers', 'divisors', 'satisfying', 'prime', 'mod',
            'integers', 'divides', 'abelian', 'satisfy'
        ];

        const isMathTask =
            intentVector.task_type === 'Computational_Execution' ||
            mathKeywords.some(kw => prompt.includes(kw));

        if (isMathTask) {
            logger.info(`[StrategySelection] Mathematical prompt detected. Selecting STRATEGY_NEUROSYN_MATH.`);
            return SynapseFabric.CONFIG.STRATEGY_NEUROSYN_MATH;
        }

        return SynapseFabric.CONFIG.STRATEGY_FAST_PATH;
    }

    async _executeFastPath({ prompt, trace, sendStreamData }) {
        const agent = AgentRegistry.getAgent('AnalyticalThinker');
        const result = await agent.think({ prompt }, sendStreamData);
        sendStreamData('content', { content: result.content, traceId: trace.id });
        return { finalResponse: result.content, trace };
    }

    _sendStatus(sendStreamData, message, traceId) {
        sendStreamData('status', { message, traceId });
    }
}

export default new SynapseFabric();