import { db } from '#db';

const stmts = {};

function init() {
  stmts.getMultipliers = db.prepare(`SELECT * FROM xp_multipliers WHERE guild_id = ?`);
  stmts.getMultiplier = db.prepare(`SELECT * FROM xp_multipliers WHERE guild_id = ? AND target_id = ? AND type = ?`);
  stmts.setMultiplier = db.prepare(`
    INSERT INTO xp_multipliers (guild_id, target_id, type, multiplier)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, target_id, type) DO UPDATE SET multiplier = excluded.multiplier
  `);
  stmts.removeMultiplier = db.prepare(`
    DELETE FROM xp_multipliers WHERE guild_id = ? AND target_id = ? AND type = ?
  `);
  stmts.getBlacklist = db.prepare(`SELECT * FROM xp_blacklist WHERE guild_id = ?`);
  stmts.isBlacklisted = db.prepare(`SELECT 1 FROM xp_blacklist WHERE guild_id = ? AND target_id = ? AND type = ?`);
  stmts.addBlacklist = db.prepare(`
    INSERT OR IGNORE INTO xp_blacklist (guild_id, target_id, type) VALUES (?, ?, ?)
  `);
  stmts.removeBlacklist = db.prepare(`
    DELETE FROM xp_blacklist WHERE guild_id = ? AND target_id = ? AND type = ?
  `);
}

export const XPSettingsRepository = {
  init,
  getMultipliers: (guildId) => stmts.getMultipliers.all(guildId),
  getMultiplier: (guildId, targetId, type) => stmts.getMultiplier.get(guildId, targetId, type),
  setMultiplier: (guildId, targetId, type, multiplier) => stmts.setMultiplier.run(guildId, targetId, type, multiplier),
  removeMultiplier: (guildId, targetId, type) => stmts.removeMultiplier.run(guildId, targetId, type),
  getBlacklist: (guildId) => stmts.getBlacklist.all(guildId),
  isBlacklisted: (guildId, targetId, type) => !!stmts.isBlacklisted.get(guildId, targetId, type),
  addBlacklist: (guildId, targetId, type) => stmts.addBlacklist.run(guildId, targetId, type),
  removeBlacklist: (guildId, targetId, type) => stmts.removeBlacklist.run(guildId, targetId, type),
};
