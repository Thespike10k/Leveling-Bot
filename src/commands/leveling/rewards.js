import { SlashCommandBuilder } from 'discord.js';
import { emoji } from '#utils/emoji';
import { Command } from '#structures/classes/Command';
import { GuildService } from '../../database/services/GuildService.js';
import {
  buildLevelPanel,
  buildUsagePanel,
  getSystemFooter,
  getSystemThumbnail,
  panelReply,
  PANEL_ACCENTS,
} from './_panel.js';

const COMMAND_NAME = 'rewards';

export const command = new Command({
  name: COMMAND_NAME,
  aliases: ['rl'],
  description: 'View all level role rewards for this server',
  category: 'Leveling',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('View all level role rewards for this server'),

  async execute(ctx) {
    const list = GuildService.listRewards(ctx.guildId);

    if (!list.length) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'Level Rewards',
        problem: 'No level rewards are configured for this server yet.',
        commandName: COMMAND_NAME,
        examples: ['addreward 10 @vip'],
        note: 'Admins can add reward milestones with the addreward command.',
        accentColor: PANEL_ACCENTS.info,
      })));
    }

    const grouped = {};
    for (const reward of list) {
      (grouped[reward.level] ??= []).push(reward.role_id);
    }

    const lines = Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([level, roles]) => `- Level **${level}**: ${roles.map(id => `<@&${id}>`).join(', ')}`);

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'Level Rewards',
      subtitle: ctx.guild?.name ?? 'Server Rewards',
      accentColor: PANEL_ACCENTS.gold,
      thumbnailUrl: getSystemThumbnail(ctx),
      sections: [
        {
          title: 'Reward Milestones',
          icon: emoji.aerox.gift,
          lines,
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
