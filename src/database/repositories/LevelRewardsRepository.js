import { db } from '#db';

const stmts = {};

function init() {
  stmts.list = db.prepare(`SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level ASC`);
  stmts.forLevel = db.prepare(`SELECT * FROM level_rewards WHERE guild_id = ? AND level <= ? ORDER BY level ASC`);
  stmts.exact = db.prepare(`SELECT * FROM level_rewards WHERE guild_id = ? AND level = ?`);
  stmts.add = db.prepare(`
    INSERT OR IGNORE INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?)
  `);
  stmts.remove = db.prepare(`
    DELETE FROM level_rewards WHERE guild_id = ? AND level = ? AND role_id = ?
  `);
  stmts.removeLevel = db.prepare(`DELETE FROM level_rewards WHERE guild_id = ? AND level = ?`);
  stmts.count = db.prepare(`SELECT COUNT(*) as c FROM level_rewards WHERE guild_id = ?`);
}

export const LevelRewardsRepository = {
  init,
  list: (guildId) => stmts.list.all(guildId),
  forLevel: (guildId, level) => stmts.forLevel.all(guildId, level),
  exact: (guildId, level) => stmts.exact.all(guildId, level),
  add: (guildId, level, roleId) => stmts.add.run(guildId, level, roleId),
  remove: (guildId, level, roleId) => stmts.remove.run(guildId, level, roleId),
  removeLevel: (guildId, level) => stmts.removeLevel.run(guildId, level),
  count: (guildId) => stmts.count.get(guildId)?.c ?? 0,
};
