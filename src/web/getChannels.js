// src/web/getChannels.js
import { logger } from '../utils/logger.js';
import { isAuthorized } from './auth.js';

const GUILD_ID = process.env.GUILD_ID;

export function registerGetChannelsRoute(app, client) {
  app.post('/api/get-channels', async (req, res) => {
    const { token } = req.body;

    if (!isAuthorized(token)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!GUILD_ID) {
      return res.status(500).json({ error: 'GUILD_ID not configured' });
    }

    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      await guild.channels.fetch();

      const textChannels = guild.channels.cache
        .filter(ch => ch.type === 0 || ch.type === 5) // Text + Announcement
        .map(ch => ({
          id: ch.id,
          name: ch.name,
          category: ch.parent ? ch.parent.name : 'No category',
          categoryId: ch.parentId || null,
          position: ch.rawPosition,
        }))
        .sort((a, b) => a.position - b.position);

      // Group by category
      const categories = {};
      for (const ch of textChannels) {
        if (!categories[ch.category]) {
          categories[ch.category] = [];
        }
        categories[ch.category].push({ id: ch.id, name: ch.name });
      }

      res.json({ ok: true, categories });
    } catch (err) {
      logger.error('[GetChannels] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
}