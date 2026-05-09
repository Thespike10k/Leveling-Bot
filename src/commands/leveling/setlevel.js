import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { emoji } from '#utils/emoji';
import { Command } from '#structures/classes/Command';
import { UserService } from '../../database/services/UserService.js';
import { sendLevelUp } from '../../utils/LevelUpSender.js';
import { formatXP } from '#utils';
import {
  buildLevelPanel,
  buildPermissionPanel,
  buildUsagePanel,
  getSystemFooter,
  getUserThumbnail,
  panelReply,
  PANEL_ACCENTS,
} from './_panel.js';

const COMMAND_NAME = 'setlevel';
const COMMAND_USAGE = '@user <level>';

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: "Set a user's level directly (admin)",
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 3,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Set a user's level directly")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('level').setDescription('Level to set').setMinValue(0).setMaxValue(500).setRequired(true)),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['setlevel @user 25'],
      })));
    }

    const target = ctx.isSlash
      ? ctx.interaction.options.getUser('user')
      : ctx.message.mentions.users.first();

    const level = ctx.isSlash
      ? ctx.interaction.options.getInteger('level')
      : parseInt(ctx.args[1], 10);

    if (!target || Number.isNaN(level) || level < 0) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'Level Override',
        problem: 'Provide a valid user mention and a level between 0 and 500.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['setlevel @user 25'],
      })));
    }

    if (target.bot) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'Level Override',
        problem: 'Bots do not have leveling profiles.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['setlevel @user 25'],
      })));
    }

    const { xpSet, oldLevel } = UserService.setLevel(target.id, ctx.guildId, level);

    if (level > oldLevel) {
      await sendLevelUp(ctx.client, ctx.channel, target, ctx.guildId, level);
    }

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'Level Override',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: PANEL_ACCENTS.purple,
      thumbnailUrl: getUserThumbnail(target),
      sections: [
        {
          title: 'Target Profile',
          icon: '👤',
          lines: [
            `- User: <@${target.id}>`,
            `- New Level: **${level}**`,
          ],
        },
        {
          title: 'Applied Values',
          icon: emoji.aerox.chart,
          lines: [
            `- XP Set: **${formatXP(xpSet)}**`,
            `- Status: Level profile updated successfully.`,
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
