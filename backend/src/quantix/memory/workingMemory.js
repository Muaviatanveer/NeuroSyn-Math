/**
 * @file src/quantix/memory/workingMemory.js
 * @description NeuroSyn Working Memory Store.
 * Tracks session states, active proof strategy attempts, symbolic variables, and Lean repair frames.
 */
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

export class WorkingMemory {
    constructor() {
        this.processId = `session_${uuidv4().substring(0, 8)}`;
        this.global = new Map(); // Global variables persisting across proof repair attempts
        this.attempts = []; // Proof strategy & repair attempts
        this.currentAttemptIndex = -1;
        logger.info(`[WorkingMemory] Initialized NeuroSyn session: ${this.processId}`);
    }

    /**
     * Initializes a new state frame for a proof strategy or repair attempt.
     */
    startNewAttempt() {
        this.currentAttemptIndex++;
        this.attempts[this.currentAttemptIndex] = {
            attemptNumber: this.currentAttemptIndex + 1,
            state: new Map(),
            timestamp: new Date(),
        };
        logger.info(`[WorkingMemory] Started proof attempt frame #${this.currentAttemptIndex + 1}`);
    }

    /**
     * Stores key-value state data in current attempt (or global scope if uninitialized).
     */
    set(key, value) {
        if (this.currentAttemptIndex < 0) {
            this.global.set(key, value);
        } else {
            this.attempts[this.currentAttemptIndex].state.set(key, value);
        }
    }

    /**
     * Retrieves key from current attempt state first, then global context.
     */
    get(key) {
        if (this.currentAttemptIndex >= 0) {
            const attemptState = this.attempts[this.currentAttemptIndex].state;
            if (attemptState.has(key)) {
                return attemptState.get(key);
            }
        }
        return this.global.get(key);
    }

    /**
     * Retrieves past attempt frame.
     */
    getPastAttemptState(attemptIndex) {
        if (attemptIndex >= 0 && attemptIndex < this.attempts.length) {
            return this.attempts[attemptIndex].state;
        }
        return null;
    }

    /**
     * Resets memory session.
     */
    clear() {
        this.global.clear();
        this.attempts = [];
        this.currentAttemptIndex = -1;
        logger.info(`[WorkingMemory] Session ${this.processId} cleared.`);
    }

    /**
     * Returns a serializable JSON snapshot.
     */
    getSnapshot() {
        const serializeMap = (map) => Object.fromEntries(map.entries());
        return {
            processId: this.processId,
            global: serializeMap(this.global),
            attempts: this.attempts.map(attempt => ({
                ...attempt,
                state: serializeMap(attempt.state),
            })),
        };
    }
}