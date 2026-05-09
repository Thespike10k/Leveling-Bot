import { VoiceTrackingService } from '../../../database/services/VoiceTrackingService.js';
import { logger } from '#utils/logger';

const log = logger.tag('VoiceXP');

export const event = {
  name: 'voiceStateUpdate',
  async execute(client, oldState, newState) {
    const userId = newState.id;
    const guildId = newState.guild.id;

    const joinedChannel = !oldState.channelId && newState.channelId;
    const leftChannel = oldState.channelId && !newState.channelId;
    const switched = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    const sessionKey = `${userId}:${guildId}`;

    if (joinedChannel) {
      if (!newState.member?.user.bot) {
        VoiceTrackingService.startSession(client, userId, guildId, newState.channelId);
      }
    }

    if (leftChannel || switched) {
      if (client.voiceSessions.has(sessionKey)) {
        const leftAt = Math.floor(Date.now() / 1000);
        const result = switched
          ? VoiceTrackingService.switchSession(client, userId, guildId, newState.channelId, leftAt)
          : VoiceTrackingService.endSession(client, userId, guildId, leftAt);

        if (result.gained > 0) {
          // No log here
        }
      }
    }
  },
};
