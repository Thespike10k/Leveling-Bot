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

const COMMAND_NAME = 'setprefix';
const COMMAND_USAGE = '<new prefix>';

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: 'Change the server prefix',
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Change the server prefix')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('prefix').setDescription('New prefix (1-5 characters)').setMinLength(1).setMaxLength(5).setRequired(true)
    ),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['setprefix !', 'setprefix ?'],
      })));
    }

    const newPrefix = ctx.isSlash
      ? ctx.interaction.options.getString('prefix')
      : ctx.args[0];

    if (!newPrefix || !newPrefix.trim() || newPrefix.length > 5) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'Server Prefix',
        problem: 'Provide a prefix between 1 and 5 visible characters.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['setprefix !', 'setprefix ?'],
      })));
    }

    GuildService.setPrefix(ctx.guildId, newPrefix);
    ctx.client.invalidatePrefixCache?.(ctx.guildId);

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'Server Prefix Updated',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: PANEL_ACCENTS.success,
      thumbnailUrl: getSystemThumbnail(ctx),
      sections: [
        {
          title: 'Prefix Settings',
          icon: emoji.aerox.settings,
          lines: [
            `- New Prefix: \`${newPrefix}\``,
            `- Example: \`${newPrefix}level\``,
            `- Example: \`${newPrefix}lb\``,
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
