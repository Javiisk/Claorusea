// src/web/auth.js
import { logger } from '../utils/logger.js';

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://javiisk.github.io/Adoresa-Website/';
const ALLOWED_USER_IDS = ['1397786545104224268'];
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

// In-memory sessions (se pierden al reiniciar, pero el usuario solo tendrá que re-loguearse)
const sessions = new Map(); // token → { userId, createdAt }

function generateToken() {
  return [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function isAuthorized(token) {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return false;
  }
  return ALLOWED_USER_IDS.includes(session.userId);
}

export function registerAuthRoutes(app) {
  // ─── Exchange code for access token ─────────────────────────────────
  app.post('/api/auth/callback', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    try {
      // 1. Exchange the code for an access token
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        logger.error('[Auth] Token exchange failed:', err);
        return res.status(401).json({ error: 'Token exchange failed' });
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // 2. Get the user's info
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        return res.status(401).json({ error: 'Failed to fetch user' });
      }

      const user = await userRes.json();

      // 3. Check if user is authorized
      if (!ALLOWED_USER_IDS.includes(user.id)) {
        logger.warn(`[Auth] Unauthorized login attempt by ${user.username} (${user.id})`);
        return res.status(403).json({ error: 'Access denied', userId: user.id });
      }

      // 4. Create a session token
      const sessionToken = generateToken();
      sessions.set(sessionToken, { userId: user.id, createdAt: Date.now() });

      logger.info(`[Auth] Login successful: ${user.username} (${user.id})`);

      res.json({
        ok: true,
        token: sessionToken,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
      });
    } catch (err) {
      logger.error('[Auth] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Verify an existing session ─────────────────────────────────────
  app.post('/api/auth/verify', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const session = sessions.get(token);
    if (!session) return res.status(401).json({ error: 'Invalid token' });

    if (Date.now() - session.createdAt > SESSION_TTL) {
      sessions.delete(token);
      return res.status(401).json({ error: 'Token expired' });
    }

    res.json({ ok: true, userId: session.userId });
  });
}