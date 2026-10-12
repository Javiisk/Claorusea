// src/utils/staffSync.js
import { logger } from './logger.js';
import { getAllStaff, updateStaffRank } from './staffStorage.js';
import { getRobloxGroupRank } from './bloxlink.js';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const SYNC_INTERVAL_MS = 2 * 60 * 1000; // ✅ Cada 2 minutos

// ─── TRELLO HELPERS ─────────────────────────────────────────────────────
async function updateTrelloCard(cardId, newRank) {
  if (!TRELLO_API_KEY || !TRELLO_TOKEN || !cardId) return false;
  try {
    const res = await fetch(
      `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Updated rank: ${newRank}`,
          desc: `Rank updated automatically at ${new Date().toISOString()}`,
        }),
      }
    );
    return res.ok;
  } catch (err) {
    logger.error('[StaffSync] Trello update failed:', err.message);
    return false;
  }
}

// ─── SYNC LOOP ──────────────────────────────────────────────────────────
export async function syncRanks(client, singleDiscordId = null) {
  let staff = await getAllStaff();

  if (singleDiscordId) {
    staff = staff.filter(s => s.discordId === singleDiscordId);
  }

  if (staff.length === 0) return 0;

  let updated = 0;

  for (const member of staff) {
    if (!member.robloxId) continue;

    try {
      const currentRank = await getRobloxGroupRank(member.robloxId);
      if (!currentRank) continue;
      if (currentRank === 'Error fetching rank' || currentRank === 'Not in the group') continue;

      if (currentRank !== member.rank) {
        logger.info(`[StaffSync] ${member.robloxUsername}: ${member.rank} → ${currentRank}`);
        await updateStaffRank(member.discordId, currentRank);

        if (member.trelloCardId) {
          await updateTrelloCard(member.trelloCardId, currentRank);
        }

        const NOTIFY_CHANNEL_ID = process.env.STAFF_SYNC_CHANNEL_ID;
        if (NOTIFY_CHANNEL_ID) {
          try {
            const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
            if (channel) {
              await channel.send(
                `🔄 <@${member.discordId}> was promoted from **${member.rank}** to **${currentRank}** on Roblox.`
              );
            }
          } catch {}
        }

        updated++;
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      logger.warn(`[StaffSync] Failed to check ${member.robloxUsername}:`, err.message);
    }
  }

  return updated;
}

// ─── START ──────────────────────────────────────────────────────────────
let started = false;
export function startStaffSync(client) {
  if (started) return;
  started = true;

  // ✅ Primera ejecución a los 10 segundos
  setTimeout(() => syncRanks(client).catch(e => logger.error(e.message)), 10 * 1000);

  // ✅ Luego cada 2 minutos
  setInterval(() => {
    syncRanks(client).catch(e => logger.error(e.message));
  }, SYNC_INTERVAL_MS);

  logger.info('✅ Staff sync started (every 2 minutes)');
}