const crypto = require("crypto");

const SESSION_TTL_MS = 30 * 60 * 1000;
const FAILED_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

class SessionManager {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.sessions = new Map();
    this.failedAttempts = new Map();
  }

  createSession(userId) {
    const sessionId = crypto.randomBytes(32).toString("hex");
    const expiresAt = this.now() + SESSION_TTL_MS;

    this.sessions.set(sessionId, { userId, expiresAt });

    return { sessionId, expiresAt };
  }

  getSession(sessionId) {
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    if (session.expiresAt <= this.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    session.expiresAt = this.now() + SESSION_TTL_MS;
    return session;
  }

  invalidate(sessionId) {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }

  isLocked(email) {
    const record = this.failedAttempts.get(email);
    return Boolean(record && record.lockedUntil > this.now());
  }

  registerFailure(email) {
    const now = this.now();
    const record = this.failedAttempts.get(email) || { attempts: [], lockedUntil: 0 };
    record.attempts = record.attempts.filter((attemptAt) => now - attemptAt < FAILED_WINDOW_MS);
    record.attempts.push(now);

    if (record.attempts.length >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS;
    }

    this.failedAttempts.set(email, record);
  }

  resetFailures(email) {
    this.failedAttempts.delete(email);
  }
}

module.exports = {
  FAILED_WINDOW_MS,
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  SESSION_TTL_MS,
  SessionManager
};
