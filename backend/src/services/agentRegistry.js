/**
 * @file src/services/agentRegistry.js
 * @description Centralized Agent Registry for NeuroSyn-Math.
 * Manages the registration, metadata, status, and dynamic capability lookup of neural specialist agents.
 */
import logger from '../utils/logger.js';

class AgentRegistry {
    constructor() {
        if (AgentRegistry.instance) return AgentRegistry.instance;

        this.agents = new Map();
        this.logger = logger;
        this.logger.info("[AgentRegistry] Registry initialized.");

        AgentRegistry.instance = this;
    }

    /**
     * Registers a specialist agent instance with capability metadata.
     */
    register(name, agentInstance) {
        if (this.agents.has(name)) {
            this.logger.warn(`[AgentRegistry] Re-registering agent "${name}".`);
        }

        const capabilitiesMap = {};
        if (Array.isArray(agentInstance.capabilities)) {
            agentInstance.capabilities.forEach(cap => {
                capabilitiesMap[cap] = { task: cap, schema: {} };
            });
        } else if (agentInstance.capabilities && typeof agentInstance.capabilities === 'object') {
            Object.assign(capabilitiesMap, agentInstance.capabilities);
        }

        const metadata = {
            status: 'active',
            type: agentInstance.tags?.includes('system') ? 'system' : 'standard',
            capabilities: capabilitiesMap,
            provider: 'NeuroSyn'
        };

        this.agents.set(name, { agent: agentInstance, metadata });
        this.logger.info(`[AgentRegistry] Registered agent "${name}" with capabilities: [${Object.keys(capabilitiesMap).join(', ')}]`);
    }

    /**
     * Returns an active agent by name.
     */
    getAgent(name) {
        const entry = this.agents.get(name);
        if (entry?.metadata.status === 'active') return entry.agent;
        return null;
    }

    /**
     * Finds the first active agent matching a name substring.
     */
    findAgentByNameSimilarity(searchString) {
        if (!searchString) return null;
        const lower = searchString.toLowerCase();
        for (const [name, entry] of this.agents.entries()) {
            if (entry.metadata.status === 'active' && name.toLowerCase().includes(lower)) {
                return entry.agent;
            }
        }
        return null;
    }

    /**
     * Returns all active agents possessing a specific capability.
     */
    getAgentsByCapability(capability) {
        return Array.from(this.agents.entries())
            .filter(([_, entry]) => entry.metadata.status === 'active' &&
                entry.metadata.capabilities &&
                Object.keys(entry.metadata.capabilities).includes(capability))
            .map(([name, entry]) => ({ name, agent: entry.agent }));
    }

    /**
     * Lists all registered agents and their metadata.
     */
    listAllAgents() {
        return Array.from(this.agents.entries()).map(([name, { metadata }]) => ({
            name,
            capabilities: Object.keys(metadata.capabilities),
            status: metadata.status
        }));
    }

    /**
     * Unregisters an agent from the pool.
     */
    unregister(name) {
        this.agents.delete(name);
    }
}

const instance = new AgentRegistry();
export default instance;