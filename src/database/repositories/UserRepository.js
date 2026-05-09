import { db } from '#db';

const stmts = {};

function init() {
  stmts.get = db.prepare(`SELECT * FROM users WHERE user_id = ? AND guild_id = ?`);
  stmts.upsert = db.prepare(`
    INSERT INTO users (user_id, guild_id, xp, level, messages, voice_mins, voice_secs, last_xp_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT (user_id, guild_id) DO UPDATE SET
      xp = excluded.xp,
      level = excluded.level,
      messages = excluded.messages,
      voice_mins = excluded.voice_mins,
      voice_secs = excluded.voice_secs,
      last_xp_at = excluded.last_xp_at,
      updated_at = unixepoch()
  `);
  stmts.addXP = db.prepare(`
    UPDATE users SET xp = xp + ?, last_xp_at = ?, updated_at = unixepoch()
    WHERE user_id = ? AND guild_id = ?
  `);
  stmts.incrementMessages = db.prepare(`
    UPDATE users SET messages = messages + 1, updated_at = unixepoch()
    WHERE user_id = ? AND guild_id = ?
  `);
  stmts.setLevel = db.prepare(`
    UPDATE users SET level = ?, updated_at = unixepoch() WHERE user_id = ? AND guild_id = ?
  `);
  stmts.setXP = db.prepare(`
    UPDATE users SET xp = ?, level = ?, updated_at = unixepoch() WHERE user_id = ? AND guild_id = ?
  `);
  stmts.addVoice = db.prepare(`
    UPDATE users
    SET
      voice_secs = voice_secs + ?,
      voice_mins = CAST((voice_secs + ?) / 60 AS INTEGER),
      xp = xp + ?,
      updated_at = unixepoch()
    WHERE user_id = ? AND guild_id = ?
  `);
  stmts.leaderboard = db.prepare(`
    SELECT user_id, xp, level, messages, voice_mins, voice_secs
    FROM users WHERE guild_id = ?
    ORDER BY xp DESC LIMIT ?
  `);
  stmts.topChatters = db.prepare(`
    SELECT user_id, xp, level, messages, voice_mins, voice_secs
    FROM users WHERE guild_id = ? AND messages > 0
    ORDER BY messages DESC, xp DESC, user_id ASC
    LIMIT ?
  `);
  stmts.guildVoiceTotals = db.prepare(`
    SELECT
      COALESCE(SUM(voice_secs), 0) AS total_voice_secs
    FROM users
    WHERE guild_id = ?
  `);
  stmts.topSpeakers = db.prepare(`
    SELECT user_id, xp, level, messages, voice_mins, voice_secs
    FROM users
    WHERE guild_id = ? AND voice_secs > 0
    ORDER BY voice_secs DESC, xp DESC, user_id ASC
    LIMIT ?
  `);
  stmts.rank = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM users
    WHERE guild_id = ? AND xp > (SELECT xp FROM users WHERE user_id = ? AND guild_id = ?)
  `);
  stmts.ensure = db.prepare(`
    INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?, ?)
  `);
}

export const UserRepository = {
  init,
  ensure: (userId, guildId) => stmts.ensure.run(userId, guildId),
  get: (userId, guildId) => stmts.get.get(userId, guildId),
  addXP: (userId, guildId, xp, now) => stmts.addXP.run(xp, now, userId, guildId),
  incrementMessages: (userId, guildId) => stmts.incrementMessages.run(userId, guildId),
  setLevel: (userId, guildId, level) => stmts.setLevel.run(level, userId, guildId),
  setXP: (userId, guildId, xp, level) => stmts.setXP.run(xp, level, userId, guildId),
  addVoice: (userId, guildId, durationSecs, xp) =>
    stmts.addVoice.run(durationSecs, durationSecs, xp, userId, guildId),
  leaderboard: (guildId, limit = 10) => stmts.leaderboard.all(guildId, limit),
  topChatters: (guildId, limit = 10) => stmts.topChatters.all(guildId, limit),
  guildVoiceTotals: (guildId) => stmts.guildVoiceTotals.get(guildId),
  topSpeakers: (guildId, limit = 10) => stmts.topSpeakers.all(guildId, limit),
  rank: (userId, guildId) => stmts.rank.get(guildId, userId, guildId)?.rank ?? 1,
};
