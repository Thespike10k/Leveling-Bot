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

const COMMAND_NAME = 'givexp';
const COMMAND_USAGE = '@user <amount>';

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: 'Give or remove XP from a user (admin)',
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 3,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Give or remove XP from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('XP amount (negative to remove)').setRequired(true)),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['givexp @user 150', 'givexp @user -75'],
      })));
    }

    const target = ctx.isSlash
      ? ctx.interaction.options.getUser('user')
      : ctx.message.mentions.users.first();

    const amount = ctx.isSlash
      ? ctx.interaction.options.getInteger('amount')
      : parseInt(ctx.args[1], 10);

    if (!target || Number.isNaN(amount)) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Adjustment',
        problem: 'Provide a valid user mention and XP amount.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['givexp @user 150', 'givexp @user -75'],
        note: 'Use a negative value to remove XP from a profile.',
      })));
    }

    if (target.bot) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Adjustment',
        problem: 'Bots do not have leveling profiles.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['givexp @user 150'],
      })));
    }

    const { newXp, level, oldLevel } = UserService.giveXP(target.id, ctx.guildId, amount);
    const sign = amount >= 0 ? `+${formatXP(amount)}` : formatXP(amount);

    if (level > oldLevel) {
      await sendLevelUp(ctx.client, ctx.channel, target, ctx.guildId, level);
    }

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'XP Adjustment',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: amount >= 0 ? PANEL_ACCENTS.success : PANEL_ACCENTS.warning,
      thumbnailUrl: getUserThumbnail(target),
      sections: [
        {
          title: 'Target Profile',
          icon: '👤',
          lines: [
            `- User: <@${target.id}>`,
            `- Change: **${sign} XP**`,
          ],
        },
        {
          title: 'Updated Stats',
          icon: emoji.aerox.chart,
          lines: [
            `- Total XP: **${formatXP(newXp)}**`,
            `- Level: **${level}**`,
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
