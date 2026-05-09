import { db } from '#db';

const stmts = {};

function init() {
  stmts.get = db.prepare(`SELECT * FROM streaks WHERE user_id = ? AND guild_id = ?`);
  stmts.ensure = db.prepare(`INSERT OR IGNORE INTO streaks (user_id, guild_id) VALUES (?, ?)`);
  stmts.update = db.prepare(`
    UPDATE streaks SET current = ?, best = MAX(best, ?), last_day = ?, last_claim_at = ?
    WHERE user_id = ? AND guild_id = ?
  `);
  stmts.reset = db.prepare(`
    UPDATE streaks SET current = ?, best = MAX(best, best), last_day = ?, last_claim_at = ?
    WHERE user_id = ? AND guild_id = ?
  `);
}

export const StreakRepository = {
  init,
  get: (userId, guildId) => stmts.get.get(userId, guildId),
  ensure: (userId, guildId) => stmts.ensure.run(userId, guildId),
  update: (userId, guildId, current, lastDay, lastClaimAt) =>
    stmts.update.run(current, current, lastDay, lastClaimAt, userId, guildId),
  reset: (userId, guildId, current, lastDay, lastClaimAt) =>
    stmts.reset.run(current, lastDay, lastClaimAt, userId, guildId),
};
