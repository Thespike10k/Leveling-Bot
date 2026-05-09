import { UserService } from '../../../database/services/UserService.js';
import { GuildService } from '../../../database/services/GuildService.js';
import { GuildSettingsRepository } from '../../../database/repositories/GuildSettingsRepository.js';
import { emoji } from '#utils/emoji';
import { config } from '#config';
import { formatXP, progressBar } from '#utils';
import {
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { sendLevelUp } from '../../../utils/LevelUpSender.js';

export const event = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot || !message.guild) return;

    const gs = GuildSettingsRepository.get(message.guild.id);
    const roleIds = message.member?.roles?.cache?.map(r => r.id) ?? [];
    
    // Process message: Always increments count, attempts XP if not a command
    const isCommand = (gs?.prefix && message.content.startsWith(gs.prefix)) || 
                      message.content.startsWith(config.prefix);

    const result = UserService.processUserMessage(
      message.author.id, 
      message.guild.id, 
      message.channel.id, 
      isCommand ? [] : roleIds
    );

    // If it was a command, we already counted the message, 
    // but we should exit early for XP display/level ups
    if (isCommand) return;

    if (result.leveledUp) {
      sendLevelUp(client, message.channel, message.author, message.guild.id, result.newLevel, result.mult).catch(err => {
        console.error('[LevelUp] Background Sender Failure:', err);
      });
    }
  },
};
