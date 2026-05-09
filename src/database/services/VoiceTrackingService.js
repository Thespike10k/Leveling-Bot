import { LogRepository } from '../repositories/LogRepository.js';
import { UserService } from './UserService.js';
import { logger } from '#utils/logger';

const log = logger.tag('VoiceTracking');

function sessionKey(userId, guildId) {
  return `${userId}:${guildId}`;
}

function splitSessionKey(key) {
  const [userId, guildId] = key.split(':');
  return { userId, guildId };
}

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function toDurationSeconds(startedAt, endedAt) {
  return Math.max(0, Math.floor(endedAt - startedAt));
}

export const VoiceTrackingService = {
  startSession(client, userId, guildId, channelId, joinedAt = nowTs()) {
    client.voiceSessions.set(sessionKey(userId, guildId), { joinedAt, channelId });
    LogRepository.voiceJoin(userId, guildId, channelId, joinedAt);
  },

  endSession(client, userId, guildId, leftAt = nowTs()) {
    const key = sessionKey(userId, guildId);
    const session = client.voiceSessions.get(key);
    if (!session) return { durationSecs: 0, gained: 0 };

    const durationSecs = toDurationSeconds(session.joinedAt, leftAt);
    const durationMins = Math.floor(durationSecs / 60);

    LogRepository.voiceLeave(userId, guildId, leftAt, durationMins, durationSecs);
    const gained = UserService.addVoiceXP(userId, guildId, durationSecs);

    client.voiceSessions.delete(key);

    return { durationSecs, durationMins, gained };
  },

  switchSession(client, userId, guildId, nextChannelId, leftAt = nowTs()) {
    const result = this.endSession(client, userId, guildId, leftAt);
    this.startSession(client, userId, guildId, nextChannelId, leftAt);
    return result;
  },

  restoreSessions(client) {
    const currentTs = nowTs();
    const liveStates = new Map();

    for (const guild of client.guilds.cache.values()) {
      for (const state of guild.voiceStates.cache.values()) {
        if (!state.channelId || state.member?.user?.bot) continue;

        liveStates.set(sessionKey(state.id, guild.id), {
          userId: state.id,
          guildId: guild.id,
          channelId: state.channelId,
        });
      }
    }

    const openSessions = LogRepository.openVoiceSessions();
    const restored = new Set();

    for (const row of openSessions) {
      const key = sessionKey(row.user_id, row.guild_id);
      const live = liveStates.get(key);

      if (live && live.channelId === row.channel_id) {
        client.voiceSessions.set(key, {
          joinedAt: row.joined_at,
          channelId: row.channel_id,
        });
        restored.add(key);
        continue;
      }

      const durationSecs = toDurationSeconds(row.joined_at, currentTs);
      const durationMins = Math.floor(durationSecs / 60);

      LogRepository.voiceLeave(row.user_id, row.guild_id, currentTs, durationMins, durationSecs);
      UserService.addVoiceXP(row.user_id, row.guild_id, durationSecs);
    }

    for (const [key, live] of liveStates) {
      if (restored.has(key)) continue;

      client.voiceSessions.set(key, {
        joinedAt: currentTs,
        channelId: live.channelId,
      });
      LogRepository.voiceJoin(live.userId, live.guildId, live.channelId, currentTs);
    }

    if (openSessions.length || liveStates.size) {
      // Sessions restored
    }
  },

  flushSessions(client) {
    const currentTs = nowTs();

    for (const key of [...client.voiceSessions.keys()]) {
      const { userId, guildId } = splitSessionKey(key);
      this.endSession(client, userId, guildId, currentTs);
    }
  },

  registerShutdownHooks(client) {
    if (client.voiceShutdownHooksRegistered) return;
    client.voiceShutdownHooksRegistered = true;

    let flushed = false;
    const flush = () => {
      if (flushed) return;
      flushed = true;
      this.flushSessions(client);
    };

    process.once('beforeExit', flush);
    process.once('SIGINT', () => {
      flush();
      process.exit(0);
    });
    process.once('SIGTERM', () => {
      flush();
      process.exit(0);
    });
  },
};
