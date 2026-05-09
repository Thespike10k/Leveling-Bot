import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { emoji } from '#utils/emoji';
import { Command } from '#structures/classes/Command';
import { GuildService } from '../../database/services/GuildService.js';
import {
  buildLevelPanel,
  buildPermissionPanel,
  buildUsagePanel,
  getSystemFooter,
  getSystemThumbnail,
  panelReply,
  PANEL_ACCENTS,
} from './_panel.js';

const COMMAND_NAME = 'xprange';
const COMMAND_USAGE = '<min> <max>';

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: 'Set the min/max XP earned per message',
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Set the min/max XP earned per message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('min').setDescription('Minimum XP per message').setMinValue(1).setMaxValue(500).setRequired(true))
    .addIntegerOption(o => o.setName('max').setDescription('Maximum XP per message').setMinValue(1).setMaxValue(500).setRequired(true)),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['xprange 15 40'],
      })));
    }

    const min = ctx.isSlash
      ? ctx.interaction.options.getInteger('min')
      : parseInt(ctx.args[0], 10);
    const max = ctx.isSlash
      ? ctx.interaction.options.getInteger('max')
      : parseInt(ctx.args[1], 10);

    if (Number.isNaN(min) || Number.isNaN(max) || min < 1 || max < min || max > 500) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Range',
        problem: 'The minimum must be at least 1, and the maximum must be between the minimum and 500.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['xprange 15 40'],
      })));
    }

    GuildService.setXPRange(ctx.guildId, min, max);

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'XP Range Updated',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: PANEL_ACCENTS.cyan,
      thumbnailUrl: getSystemThumbnail(ctx),
      sections: [
        {
          title: 'Message XP',
          icon: emoji.aerox.bolt,
          lines: [
            `• Minimum: **${min} XP**`,
            `• Maximum: **${max} XP**`,
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
