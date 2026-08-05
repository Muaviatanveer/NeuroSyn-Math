/**
 * @file backend/src/config/db.js
 * @description Local MongoDB Connection, Unique User Registration & Password Hashing.
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import logger from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/neurosyn_math';

// 1. USER SCHEMA
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    salt: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

userSchema.methods.setPassword = function (password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.passwordHash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex');
};

userSchema.methods.validatePassword = function (password) {
    const hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex');
    return this.passwordHash === hash;
};

// 2. HISTORY SCHEMA
const historySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    prompt: { type: String, required: true },
    primaryDomain: { type: String, default: 'Algebra' },
    verifiedInLean: { type: Boolean, default: false },
    confidence: { type: Number, default: 0.0 },
    elapsedSeconds: { type: Number, default: 0.0 },
    explanation: { type: String, default: '' },
    formalProof: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const History = mongoose.models.History || mongoose.model('History', historySchema);

export class DatabaseService {
    constructor() {
        this.isConnected = false;
    }

    async connect() {
        if (this.isConnected) return true;
        try {
            const connectPromise = mongoose.connect(MONGODB_URI, { 
                serverSelectionTimeoutMS: 3000, 
                connectTimeoutMS: 3000,
                family: 4 
            });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MongoDB Connection Timeout')), 3000));
            
            await Promise.race([connectPromise, timeoutPromise]);
            
            this.isConnected = true;
            logger.info(`[MongoDB] Connected to local database at: ${MONGODB_URI}`);
            return true;
        } catch (err) {
            this.isConnected = false;
            return false;
        }
    }

    async checkUsernameExists(username) {
        await this.connect();
        if (!this.isConnected) return false;
        const cleanUser = String(username).toLowerCase().trim();
        const existing = await User.findOne({ username: cleanUser });
        return Boolean(existing);
    }

    async registerUser(username, password) {
        await this.connect();
        if (!this.isConnected) throw new Error("Database offline.");

        const cleanUser = String(username).toLowerCase().trim();
        const exists = await this.checkUsernameExists(cleanUser);
        if (exists) {
            throw new Error(`Username '${cleanUser}' is already taken.`);
        }

        const user = new User({ username: cleanUser });
        user.setPassword(password);
        await user.save();
        return user;
    }

    async loginUser(username, password) {
        await this.connect();
        if (!this.isConnected) throw new Error("Database offline.");

        const cleanUser = String(username).toLowerCase().trim();
        const user = await User.findOne({ username: cleanUser });
        if (!user || !user.validatePassword(password)) {
            throw new Error("Invalid username or password.");
        }
        return user;
    }

    async saveHistory(user, problemText, result, elapsed) {
        if (!this.isConnected || !user || !user._id) return null;
        try {
            const entry = new History({
                userId: user._id,
                username: user.username,
                prompt: problemText,
                primaryDomain: result.primaryDomain || 'Algebra',
                verifiedInLean: !!result.verifiedInLean,
                confidence: result.confidence || 0.0,
                elapsedSeconds: parseFloat(elapsed),
                explanation: result.explanation?.undergraduate || '',
                formalProof: result.formalProof || ''
            });
            await entry.save();
            return entry;
        } catch (e) {
            return null;
        }
    }

    async getUserHistory(user) {
        if (!this.isConnected || !user || !user._id) return [];
        try {
            return await History.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20);
        } catch (e) {
            return [];
        }
    }
}

export const dbService = new DatabaseService();