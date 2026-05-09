import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '#structures/classes/Command';
import { UserService } from '../../database/services/UserService.js';
import {
  buildLevelPanel,
  buildPermissionPanel,
  buildUsagePanel,
  getSystemFooter,
  getUserThumbnail,
  panelReply,
  PANEL_ACCENTS,
} from './_panel.js';

const COMMAND_NAME = 'resetxp';
const COMMAND_USAGE = '@user';

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: "Reset a user's XP and level to 0 (admin)",
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Reset a user's XP to 0")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['resetxp @user'],
      })));
    }

    const target = ctx.isSlash
      ? ctx.interaction.options.getUser('user')
      : ctx.message.mentions.users.first();

    if (!target) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Reset',
        problem: 'Mention a valid user to reset their leveling profile.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['resetxp @user'],
      })));
    }

    if (target.bot) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Reset',
        problem: 'Bots do not have leveling profiles to reset.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['resetxp @user'],
      })));
    }

    UserService.resetXP(target.id, ctx.guildId);

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'XP Reset',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: PANEL_ACCENTS.warning,
      thumbnailUrl: getUserThumbnail(target),
      sections: [
        {
          title: 'Target Profile',
          icon: '👤',
          lines: [
            `- User: <@${target.id}>`,
            '- XP: **0**',
            '- Level: **0**',
            '- Streak: **0**',
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
