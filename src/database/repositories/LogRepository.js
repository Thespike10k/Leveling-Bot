import { db } from '#db';

const stmts = {};

const STORED_VOICE_SECONDS_SQL = `
  CASE
    WHEN duration_secs > 0 THEN duration_secs
    WHEN left_at IS NOT NULL AND left_at > joined_at THEN left_at - joined_at
    ELSE mins * 60
  END
`;

const ACTUAL_VOICE_SECONDS_SQL = `
  CASE
    WHEN left_at IS NULL THEN
      CASE
        WHEN ? > joined_at THEN ? - joined_at
        ELSE 0
      END
    ELSE ${STORED_VOICE_SECONDS_SQL}
  END
`;

function init() {
  stmts.insertMsg = db.prepare(`
    INSERT INTO message_logs (user_id, guild_id, channel_id, xp_gained)
    VALUES (?, ?, ?, ?)
  `);
  stmts.insertVoiceJoin = db.prepare(`
    INSERT INTO voice_logs (user_id, guild_id, channel_id, joined_at)
    VALUES (?, ?, ?, ?)
  `);
  stmts.updateVoiceLeave = db.prepare(`
    UPDATE voice_logs
    SET left_at = ?, mins = ?, duration_secs = ?
    WHERE id = (
      SELECT id FROM voice_logs
      WHERE user_id = ? AND guild_id = ? AND left_at IS NULL
      ORDER BY id DESC LIMIT 1
    )
  `);
  stmts.openVoiceSessions = db.prepare(`
    SELECT user_id, guild_id, channel_id, joined_at
    FROM voice_logs
    WHERE left_at IS NULL
    ORDER BY id ASC
  `);
  stmts.userActualVoiceTotal = db.prepare(`
    SELECT COALESCE(SUM(${ACTUAL_VOICE_SECONDS_SQL}), 0) AS total_voice_secs
    FROM voice_logs
    WHERE user_id = ? AND guild_id = ?
  `);
  stmts.recentMessages = db.prepare(`
    SELECT * FROM message_logs WHERE user_id = ? AND guild_id = ?
    ORDER BY ts DESC LIMIT ?
  `);
  stmts.guildMessageTotals = db.prepare(`
    SELECT COUNT(*) AS total_messages
    FROM message_logs
    WHERE guild_id = ?
  `);
  stmts.guildTopChatters = db.prepare(`
    SELECT user_id, COUNT(*) AS total_messages
    FROM message_logs
    WHERE guild_id = ?
    GROUP BY user_id
    HAVING COUNT(*) > 0
    ORDER BY total_messages DESC, user_id ASC
    LIMIT ?
  `);
  stmts.guildMessageTimestampsSince = db.prepare(`
    SELECT ts FROM message_logs
    WHERE guild_id = ? AND ts >= ?
    ORDER BY ts DESC
  `);
  stmts.guildActualVoiceTotals = db.prepare(`
    SELECT COALESCE(SUM(${ACTUAL_VOICE_SECONDS_SQL}), 0) AS total_voice_secs
    FROM voice_logs
    WHERE guild_id = ?
  `);
  stmts.guildActualTopSpeakers = db.prepare(`
    SELECT user_id, total_voice_secs
    FROM (
      SELECT
        user_id,
        COALESCE(SUM(${ACTUAL_VOICE_SECONDS_SQL}), 0) AS total_voice_secs
      FROM voice_logs
      WHERE guild_id = ?
      GROUP BY user_id
    )
    WHERE total_voice_secs > 0
    ORDER BY total_voice_secs DESC, user_id ASC
    LIMIT ?
  `);
  stmts.guildVoiceSessionsSince = db.prepare(`
    SELECT joined_at, left_at, mins, duration_secs
    FROM voice_logs
    WHERE guild_id = ?
      AND joined_at <= ?
      AND COALESCE(left_at, ?) >= ?
    ORDER BY joined_at DESC
  `);
}

export const LogRepository = {
  init,
  logMessage: (userId, guildId, channelId, xp) =>
    stmts.insertMsg.run(userId, guildId, channelId, xp),
  voiceJoin: (userId, guildId, channelId, joinedAt) =>
    stmts.insertVoiceJoin.run(userId, guildId, channelId, joinedAt),
  voiceLeave: (userId, guildId, leftAt, mins, durationSecs) =>
    stmts.updateVoiceLeave.run(leftAt, mins, durationSecs, userId, guildId),
  openVoiceSessions: () =>
    stmts.openVoiceSessions.all(),
  userActualVoiceTotal: (userId, guildId, nowTs) =>
    stmts.userActualVoiceTotal.get(nowTs, nowTs, userId, guildId),
  recentMessages: (userId, guildId, limit = 20) =>
    stmts.recentMessages.all(userId, guildId, limit),
  guildMessageTotals: (guildId) =>
    stmts.guildMessageTotals.get(guildId),
  guildTopChatters: (guildId, limit = 10) =>
    stmts.guildTopChatters.all(guildId, limit),
  guildMessageTimestampsSince: (guildId, sinceTs) =>
    stmts.guildMessageTimestampsSince.all(guildId, sinceTs),
  guildActualVoiceTotals: (guildId, nowTs) =>
    stmts.guildActualVoiceTotals.get(nowTs, nowTs, guildId),
  guildActualTopSpeakers: (guildId, nowTs, limit = 10) =>
    stmts.guildActualTopSpeakers.all(nowTs, nowTs, guildId, limit),
  guildVoiceSessionsSince: (guildId, nowTs, sinceTs) =>
    stmts.guildVoiceSessionsSince.all(guildId, nowTs, nowTs, sinceTs),
};
