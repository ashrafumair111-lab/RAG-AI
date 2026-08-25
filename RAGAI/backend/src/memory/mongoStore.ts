import { MongoClient, Db, Collection } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import type { StoredMessage, StoredSession, StoredDocument } from "../types";

/**
 * MongoDB persistence layer:
 *  - sessions   : chat session metadata
 *  - messages   : full chat history (user + assistant)
 *  - documents  : metadata of ingested knowledge-base files
 */
class MongoStore {
  private client: MongoClient;
  private db!: Db;
  private sessions!: Collection<StoredSession>;
  private messages!: Collection<StoredMessage>;
  private documents!: Collection<StoredDocument>;

  private available = false;

  // In-memory fallback storage (used when Mongo is unreachable).
  private memSessions = new Map<string, StoredSession>();
  private memMessages = new Map<string, StoredMessage[]>(); // keyed by sessionId
  private memDocuments = new Map<string, StoredDocument>();

  constructor() {
    // Default to localhost if no URL configured — never throw at build time.
    const url = config.mongoUrl || "mongodb://localhost:27017";
    this.client = new MongoClient(url, { serverSelectionTimeoutMS: 8000 });
  }

  async connect(): Promise<void> {
    if (!config.mongoUrl) {
      console.warn(
        "[mongo] MONGODB_URL not set — using in-memory persistence. " +
          "Chat history and documents are lost on restart.",
      );
      return; // stay on in-memory
    }
    try {
      await this.client.connect();
      this.db = this.client.db(config.mongoDb);
      this.sessions = this.db.collection("sessions");
      this.messages = this.db.collection("messages");
      this.documents = this.db.collection("documents");
      await this.messages.createIndex({ sessionId: 1, createdAt: 1 });
      await this.documents.createIndex({ docId: 1 }, { unique: true });
      this.available = true;
      console.log("[mongo] connected");
    } catch (err) {
      this.available = false;
      console.warn("[mongo] connection failed — using in-memory fallback:", err);
    }
  }

  // ── Sessions ──────────────────────────────────────────────────
  async createSession(title = "New chat"): Promise<StoredSession> {
    const now = new Date();
    const session: StoredSession = {
      id: uuidv4(),
      title,
      createdAt: now,
      updatedAt: now,
    };
    if (this.available) {
      await this.sessions.insertOne(session);
    } else {
      this.memSessions.set(session.id, session);
    }
    return session;
  }

  async listSessions(limit = 50): Promise<StoredSession[]> {
    if (this.available) {
      return this.sessions
        .find()
        .sort({ updatedAt: -1 })
        .limit(limit)
        .toArray();
    }
    return Array.from(this.memSessions.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async touchSession(id: string): Promise<void> {
    if (this.available) {
      await this.sessions.updateOne({ id }, { $set: { updatedAt: new Date() } });
    } else {
      const s = this.memSessions.get(id);
      if (s) this.memSessions.set(id, { ...s, updatedAt: new Date() });
    }
  }

  async renameSessionIfDefault(
    id: string,
    firstMessage: string,
  ): Promise<void> {
    const title =
      firstMessage.length > 48
        ? firstMessage.slice(0, 48).trim() + "…"
        : firstMessage.trim();
    if (this.available) {
      await this.sessions.updateOne(
        { id, title: { $in: ["New chat", ""] } },
        { $set: { title, updatedAt: new Date() } },
      );
    } else {
      const s = this.memSessions.get(id);
      if (s && (s.title === "New chat" || s.title === "")) {
        this.memSessions.set(id, { ...s, title, updatedAt: new Date() });
      }
    }
  }

  async deleteSession(id: string): Promise<void> {
    if (this.available) {
      await this.sessions.deleteOne({ id });
      await this.messages.deleteMany({ sessionId: id });
    } else {
      this.memSessions.delete(id);
      this.memMessages.delete(id);
    }
  }

  // ── Messages ──────────────────────────────────────────────────
  async addMessage(msg: Omit<StoredMessage, "createdAt">): Promise<void> {
    const full: StoredMessage = { ...msg, createdAt: new Date() };
    if (this.available) {
      await this.messages.insertOne(full);
    } else {
      const list = this.memMessages.get(msg.sessionId) ?? [];
      list.push(full);
      this.memMessages.set(msg.sessionId, list);
    }
  }

  async getMessages(
    sessionId: string,
    limit = config.historyWindow,
  ): Promise<StoredMessage[]> {
    if (this.available) {
      const recent = await this.messages
        .find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return recent.reverse();
    }
    const list = this.memMessages.get(sessionId) ?? [];
    return list.slice(-limit);
  }

  async getAllMessages(sessionId: string): Promise<StoredMessage[]> {
    if (this.available) {
      return this.messages
        .find({ sessionId })
        .sort({ createdAt: 1 })
        .toArray();
    }
    return this.memMessages.get(sessionId) ?? [];
  }

  // ── Documents ─────────────────────────────────────────────────
  async addDocument(doc: Omit<StoredDocument, "createdAt">): Promise<void> {
    const full: StoredDocument = { ...doc, createdAt: new Date() };
    if (this.available) {
      await this.documents.insertOne(full);
    } else {
      this.memDocuments.set(doc.docId, full);
    }
  }

  async listDocuments(): Promise<StoredDocument[]> {
    if (this.available) {
      return this.documents.find().sort({ createdAt: -1 }).toArray();
    }
    return Array.from(this.memDocuments.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async deleteDocument(docId: string): Promise<void> {
    if (this.available) {
      await this.documents.deleteOne({ docId });
    } else {
      this.memDocuments.delete(docId);
    }
  }
}

// Singleton instance shared across routes
export const store = new MongoStore();
