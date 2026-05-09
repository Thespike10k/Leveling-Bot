import { db } from '#db';

const stmts = {};

function init() {
  stmts.get = db.prepare(`SELECT * FROM guild_settings WHERE guild_id = ?`);
  stmts.ensure = db.prepare(`
    INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)
  `);
  stmts.set = db.prepare(`
    INSERT INTO guild_settings (guild_id, prefix, level_up_enabled, level_up_channel, level_up_dm, level_up_message,
      xp_min, xp_max, xp_cooldown_secs, stack_rewards, voice_xp_enabled, voice_xp_per_min, invite_link, support_link, level_up_background)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      prefix = excluded.prefix,
      level_up_enabled = excluded.level_up_enabled,
      level_up_channel = excluded.level_up_channel,
      level_up_dm = excluded.level_up_dm,
      level_up_message = excluded.level_up_message,
      xp_min = excluded.xp_min,
      xp_max = excluded.xp_max,
      xp_cooldown_secs = excluded.xp_cooldown_secs,
      stack_rewards = excluded.stack_rewards,
      voice_xp_enabled = excluded.voice_xp_enabled,
      voice_xp_per_min = excluded.voice_xp_per_min,
      invite_link = excluded.invite_link,
      support_link = excluded.support_link,
      level_up_background = excluded.level_up_background
  `);

  const fields = [
    'prefix','level_up_enabled','level_up_channel','level_up_dm','level_up_message',
    'xp_min','xp_max','xp_cooldown_secs','stack_rewards','voice_xp_enabled','voice_xp_per_min',
    'invite_link','support_link', 'level_up_background'
  ];
  stmts.patches = {};
  for (const f of fields) {
    stmts.patches[f] = db.prepare(`UPDATE guild_settings SET ${f} = ? WHERE guild_id = ?`);
  }
}

export const GuildSettingsRepository = {
  init,
  ensure: (guildId) => stmts.ensure.run(guildId),
  get: (guildId) => {
    stmts.ensure.run(guildId);
    return stmts.get.get(guildId);
  },
  patch: (guildId, field, value) => {
    stmts.ensure.run(guildId);
    if (!stmts.patches[field]) throw new Error(`Unknown field: ${field}`);
    return stmts.patches[field].run(value, guildId);
  },
};
