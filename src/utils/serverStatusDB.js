// src/utils/serverStatusDB.js
import { logger } from './logger.js';

const HOURS_API_SECRET = process.env.HOURS_API_SECRET || 'AdoresaHours2026_xK9mP2nQ';

// Aquí guardamos los datos de los servidores en memoria
export const activeServers = new Map();

export function registerServerStatusRoute(app) {
  app.post('/api/server-status/update', (req, res) => {
    const auth = req.headers.authorization;
    if (auth !== HOURS_API_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { serverId, staff, campers, total } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });

    activeServers.set(serverId, {
      staff,
      campers,
      total,
      lastUpdate: Date.now(),
    });

    // Limpiar servidores inactivos (más de 3 min sin actualizar)
    const now = Date.now();
    for (const [id, data] of activeServers.entries()) {
      if (now - data.lastUpdate > 3 * 60 * 1000) {
        activeServers.delete(id);
      }
    }

    res.json({ ok: true });
  });
}