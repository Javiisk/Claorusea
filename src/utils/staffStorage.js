// src/utils/staffStorage.js
import { pgDb } from './postgresDatabase.js';
import { pgConfig } from '../config/postgres.js';
import { logger } from './logger.js';

// ─── IN-MEMORY FALLBACK ─────────────────────────────────────────────────
const memoryStaff = new Map(); // discordId → staffRecord

function usePostgres() {
  return pgDb.isAvailable() && pgDb.pool;
}

// ─── ENSURE STAFF TABLE EXISTS ──────────────────────────────────────────
export async function ensureStaffTable() {
  if (!usePostgres()) return;
  try {
    await pgDb.pool.query(`
      CREATE TABLE IF NOT EXISTS staff_registry (
        discord_id VARCHAR(20) PRIMARY KEY,
        roblox_id VARCHAR(20),
        roblox_username VARCHAR(100),
        rank VARCHAR(100),
        registered_by VARCHAR(20),
        registered_at BIGINT,
        trello_card_id VARCHAR(100),
        trello_card_url TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('✅ staff_registry table ready');
  } catch (err) {
    logger.error('❌ ensureStaffTable error:', err.message);
  }
}

// ─── REGISTER / UPDATE ──────────────────────────────────────────────────
export async function registerStaff(discordId, record) {
  if (usePostgres()) {
    try {
      await pgDb.pool.query(
        `INSERT INTO staff_registry
         (discord_id, roblox_id, roblox_username, rank, registered_by, registered_at, trello_card_id, trello_card_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (discord_id) DO UPDATE SET
           roblox_id = EXCLUDED.roblox_id,
           roblox_username = EXCLUDED.roblox_username,
           rank = EXCLUDED.rank,
           trello_card_id = COALESCE(EXCLUDED.trello_card_id, staff_registry.trello_card_id),
           trello_card_url = COALESCE(EXCLUDED.trello_card_url, staff_registry.trello_card_url),
           updated_at = CURRENT_TIMESTAMP`,
        [
          discordId,
          record.robloxId || null,
          record.robloxUsername || null,
          record.rank || null,
          record.registeredBy || null,
          record.registeredAt || Date.now(),
          record.trelloCardId || null,
          record.trelloCardUrl || null,
        ]
      );
      return true;
    } catch (err) {
      logger.error('❌ registerStaff (pg) error:', err.message);
    }
  }

  memoryStaff.set(discordId, { ...record });
  return true;
}

// ─── GET ────────────────────────────────────────────────────────────────
export async function getStaff(discordId) {
  if (usePostgres()) {
    try {
      const res = await pgDb.pool.query(
        `SELECT * FROM staff_registry WHERE discord_id = $1`,
        [discordId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        discordId: r.discord_id,
        robloxId: r.roblox_id,
        robloxUsername: r.roblox_username,
        rank: r.rank,
        registeredBy: r.registered_by,
        registeredAt: r.registered_at,
        trelloCardId: r.trello_card_id,
        trelloCardUrl: r.trello_card_url,
      };
    } catch (err) {
      logger.error('❌ getStaff (pg) error:', err.message);
    }
  }
  return memoryStaff.get(discordId) || null;
}

// ─── GET ALL ────────────────────────────────────────────────────────────
export async function getAllStaff() {
  if (usePostgres()) {
    try {
      const res = await pgDb.pool.query(`SELECT * FROM staff_registry ORDER BY rank ASC`);
      return res.rows.map(r => ({
        discordId: r.discord_id,
        robloxId: r.roblox_id,
        robloxUsername: r.roblox_username,
        rank: r.rank,
        registeredBy: r.registered_by,
        registeredAt: r.registered_at,
        trelloCardId: r.trello_card_id,
        trelloCardUrl: r.trello_card_url,
      }));
    } catch (err) {
      logger.error('❌ getAllStaff (pg) error:', err.message);
    }
  }
  return Array.from(memoryStaff.values());
}

// ─── UPDATE RANK ────────────────────────────────────────────────────────
export async function updateStaffRank(discordId, newRank) {
  if (usePostgres()) {
    try {
      await pgDb.pool.query(
        `UPDATE staff_registry SET rank = $1, updated_at = CURRENT_TIMESTAMP WHERE discord_id = $2`,
        [newRank, discordId]
      );
      return true;
    } catch (err) {
      logger.error('❌ updateStaffRank (pg) error:', err.message);
    }
  }
  const existing = memoryStaff.get(discordId);
  if (existing) memoryStaff.set(discordId, { ...existing, rank: newRank });
  return true;
}

// ─── DELETE ─────────────────────────────────────────────────────────────
export async function removeStaff(discordId) {
  if (usePostgres()) {
    try {
      await pgDb.pool.query(`DELETE FROM staff_registry WHERE discord_id = $1`, [discordId]);
      return true;
    } catch (err) {
      logger.error('❌ removeStaff (pg) error:', err.message);
    }
  }
  memoryStaff.delete(discordId);
  return true;
}