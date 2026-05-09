import { db } from '#db';

const stmts = {};

function init() {
  stmts.list = db.prepare(`
    SELECT * FROM level_reward_claims
    WHERE user_id = ? AND guild_id = ?
    ORDER BY level ASC
  `);
  stmts.add = db.prepare(`
    INSERT OR IGNORE INTO level_reward_claims (user_id, guild_id, level, role_id)
    VALUES (?, ?, ?, ?)
  `);
}

export const LevelRewardClaimsRepository = {
  init,
  list: (userId, guildId) => stmts.list.all(userId, guildId),
  add: (userId, guildId, level, roleId) => stmts.add.run(userId, guildId, level, roleId),
};
