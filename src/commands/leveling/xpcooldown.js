import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '#structures/classes/Command';
import { emoji } from '#utils/emoji';
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

const COMMAND_NAME = 'xpcooldown';
const COMMAND_USAGE = '<seconds>';

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: 'Set the XP cooldown (seconds between XP awards)',
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Set the XP cooldown in seconds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('seconds').setDescription('Cooldown (0-3600 seconds)').setMinValue(0).setMaxValue(3600).setRequired(true)),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['xpcooldown 60'],
      })));
    }

    const secs = ctx.isSlash
      ? ctx.interaction.options.getInteger('seconds')
      : parseInt(ctx.args[0], 10);

    if (Number.isNaN(secs) || secs < 0 || secs > 3600) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Cooldown',
        problem: 'Cooldown must be between 0 and 3600 seconds.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['xpcooldown 60'],
      })));
    }

    GuildService.setXPCooldown(ctx.guildId, secs);

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'XP Cooldown Updated',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: PANEL_ACCENTS.cyan,
      thumbnailUrl: getSystemThumbnail(ctx),
      sections: [
        {
          title: 'Award Timing',
          icon: `${emoji.aerox.clock}`,
          lines: [
            `- Cooldown set to : **${secs} seconds**`,
            '- Users must wait this long between XP awards.',
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
