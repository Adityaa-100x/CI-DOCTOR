import mongoose from 'mongoose';
import { isDbConnected, inMemoryStore } from '../db/connection.js';

const AgentLogSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  stepNumber: { type: Number, required: true },
  actionType: { type: String, required: true }, // "thought", "tool_call", "observation", "reflection", "result"
  toolName: { type: String, default: null },
  toolArgs: { type: mongoose.Schema.Types.Mixed, default: null },
  content: { type: String, required: true },
  level: { type: String, default: 'info' }, // "info", "success", "warning", "error"
  durationSeconds: { type: Number, default: null },
  timestamp: { type: Date, default: Date.now }
});

const MongooseAgentLog = mongoose.model('AgentLog', AgentLogSchema);

export class AgentLogService {
  static async append(logEntry) {
    if (isDbConnected()) {
      try {
        return await MongooseAgentLog.create(logEntry);
      } catch (e) {
        console.warn('[AgentLogService] Mongoose write warning:', e.message);
      }
    }
    const doc = { ...logEntry, timestamp: new Date() };
    inMemoryStore.logs.push(doc);
    return doc;
  }

  static async getBySession(sessionId) {
    if (isDbConnected()) {
      try {
        return await MongooseAgentLog.find({ sessionId }).sort({ stepNumber: 1 });
      } catch (e) {
        // fallback
      }
    }
    return inMemoryStore.logs.filter(l => l.sessionId === sessionId);
  }
}

export default MongooseAgentLog;
