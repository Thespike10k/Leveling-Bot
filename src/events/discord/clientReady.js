import { ActivityType } from 'discord.js';
import { logger } from '#utils/logger';
import { emoji } from '#utils/emoji';
import { registerSlashCommands } from '../../structures/handlers/discordHandler.js';
import { VoiceTrackingService } from '../../database/services/VoiceTrackingService.js';

const log = logger.tag('Ready');

export const event = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    try {
      log.info(` Logged in as ${client.user.tag}`);
      log.info(` Serving ${client.guilds.cache.size} guild(s)`);

      client.user.setActivity({
        name: `AeroX Development <3`,
        type: ActivityType.Custom,
      });

      await registerSlashCommands(client);
      VoiceTrackingService.restoreSessions(client);
    } catch (err) {
      log.error('Crash in clientReady event:', err);
    }
  },
};
