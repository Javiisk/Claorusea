// src/web/auth.js
import { logger } from '../utils/logger.js';

const WEB_PASSWORD = process.env.WEB_PASSWORD;

// In-memory sessions
const sessions = new Map();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

function generateToken() {
  return [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function isAuthorized(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function registerAuthRoutes(app) {
  // ─── Login with password ────────────────────────────────────────────
  app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;

    if (!WEB_PASSWORD) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    if (password !== WEB_PASSWORD) {
      logger.warn('[Auth] Wrong password attempt');
      return res.status(401).json({ error: 'Wrong password' });
    }

    const token = generateToken();
    sessions.set(token, { createdAt: Date.now() });

    logger.info('[Auth] Login successful');

    res.json({ ok: true, token });
  });

  // ─── Verify token ──────────────────────────────────────────────────
  app.post('/api/auth/verify', (req, res) => {
    const { token } = req.body;
    if (!isAuthorized(token)) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.json({ ok: true });
  });

  // ─── Logout ────────────────────────────────────────────────────────
  app.post('/api/auth/logout', (req, res) => {
    const { token } = req.body;
    if (token) sessions.delete(token);
    res.json({ ok: true });
  });
}