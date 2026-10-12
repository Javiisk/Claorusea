// src/utils/staffSync.js
import { logger } from './logger.js';
import { getAllStaff, updateStaffRank } from './staffStorage.js';
import { getRobloxGroupRank } from './bloxlink.js';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // cada 30 min

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
async function syncRanks(client) {
  const staff = await getAllStaff();
  if (staff.length === 0) return;

  let updated = 0;

  for (const member of staff) {
    if (!member.robloxId) continue;

    try {
      const currentRank = await getRobloxGroupRank(member.robloxId);
      if (!currentRank) continue;
      if (currentRank === 'Error fetching rank' || currentRank === 'Not in the group') continue;

      if (currentRank !== member.rank) {
        logger.info(
          `[StaffSync] ${member.robloxUsername}: ${member.rank} → ${currentRank}`
        );
        await updateStaffRank(member.discordId, currentRank);

        if (member.trelloCardId) {
          await updateTrelloCard(member.trelloCardId, currentRank);
        }

        // Optional: notify a channel
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

      // small delay to avoid hitting Bloxlink rate limit
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      logger.warn(`[StaffSync] Failed to check ${member.robloxUsername}:`, err.message);
    }
  }

  if (updated > 0) {
    logger.info(`[StaffSync] ✅ Updated ${updated} staff ranks.`);
  }
}

// ─── START ──────────────────────────────────────────────────────────────
let started = false;
export function startStaffSync(client) {
  if (started) return;
  started = true;

  // First run after 1 min
  setTimeout(() => syncRanks(client).catch(e => logger.error(e.message)), 60 * 1000);

  // Then every 30 min
  setInterval(() => {
    syncRanks(client).catch(e => logger.error(e.message));
  }, SYNC_INTERVAL_MS);

  logger.info('✅ Staff sync started (every 30 min)');
}