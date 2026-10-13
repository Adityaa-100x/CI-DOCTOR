import mongoose from 'mongoose';
import { isDbConnected, inMemoryStore } from '../db/connection.js';

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  repoName: { type: String, required: true },
  repoPath: { type: String, required: true },
  language: { type: String, default: 'unknown' },
  framework: { type: String, default: null },
  status: { type: String, default: 'INITIALIZING' },
  targetFile: { type: String, default: null },
  diff: { type: String, default: null },
  prBranch: { type: String, default: null },
  prTitle: { type: String, default: null },
  prUrl: { type: String, default: null },
  prNumber: { type: Number, default: null },
  durationSeconds: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const MongooseSession = mongoose.model('Session', SessionSchema);

export class SessionService {
  static async create(data) {
    if (isDbConnected()) {
      try {
        return await MongooseSession.create(data);
      } catch (e) {
        console.warn('[SessionService] Mongoose write warning:', e.message);
      }
    }
    const doc = { ...data, createdAt: new Date() };
    inMemoryStore.sessions.set(data.sessionId, doc);
    return doc;
  }

  static async update(sessionId, updates) {
    if (isDbConnected()) {
      try {
        return await MongooseSession.findOneAndUpdate({ sessionId }, updates, { new: true });
      } catch (e) {
        console.warn('[SessionService] Mongoose update warning:', e.message);
      }
    }
    const current = inMemoryStore.sessions.get(sessionId) || {};
    const updated = { ...current, ...updates, updatedAt: new Date() };
    inMemoryStore.sessions.set(sessionId, updated);
    return updated;
  }

  static async get(sessionId) {
    if (isDbConnected()) {
      try {
        return await MongooseSession.findOne({ sessionId });
      } catch (e) {
        // fallback
      }
    }
    return inMemoryStore.sessions.get(sessionId) || null;
  }

  static async listRecent(limit = 10) {
    if (isDbConnected()) {
      try {
        return await MongooseSession.find().sort({ createdAt: -1 }).limit(limit);
      } catch (e) {
        // fallback
      }
    }
    return Array.from(inMemoryStore.sessions.values()).slice(-limit);
  }
}

export default MongooseSession;
