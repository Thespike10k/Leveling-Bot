import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { emoji } from '#utils/emoji';
import { Command } from '#structures/classes/Command';
import { GuildService } from '../../database/services/GuildService.js';
import {
  buildLevelPanel,
  buildPermissionPanel,
  buildUsagePanel,
  buildUsageSection,
  getSystemFooter,
  getSystemThumbnail,
  panelReply,
  PANEL_ACCENTS,
} from './_panel.js';

const COMMAND_NAME = 'voicexp';
const COMMAND_USAGE = '[on | off | rate <xp>]';

function buildStatusPanel(ctx, settings) {
  return buildLevelPanel({
    title: 'Voice XP Settings',
    subtitle: ctx.guild?.name ?? 'Server Controls',
    accentColor: PANEL_ACCENTS.cyan,
    thumbnailUrl: getSystemThumbnail(ctx),
    sections: [
      {
        title: 'Voice Progression',
        icon: emoji.aerox.voice,
        lines: [
          `- Enabled: **${(settings?.voice_xp_enabled ?? 1) ? 'Yes' : 'No'}**`,
          `- Rate: **${settings?.voice_xp_per_min ?? 10} XP/min**`,
        ],
      },
      buildUsageSection(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['voicexp on', 'voicexp rate 12'],
      }),
    ],
    footer: getSystemFooter(ctx),
  });
}

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: 'Configure voice XP settings',
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Configure voice XP settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('status').setDescription('Show the current voice XP settings'))
    .addSubcommand(s => s.setName('enable').setDescription('Enable voice XP'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable voice XP'))
    .addSubcommand(s => s.setName('rate').setDescription('Set XP earned per minute in voice')
      .addIntegerOption(o => o.setName('xp').setDescription('XP per minute').setMinValue(1).setMaxValue(100).setRequired(true))),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['voicexp on', 'voicexp rate 12'],
      })));
    }

    let action = 'status';
    let rate = null;

    if (ctx.isSlash) {
      action = ctx.interaction.options.getSubcommand();
      if (action === 'rate') {
        rate = ctx.interaction.options.getInteger('xp');
      }
    } else {
      const arg = ctx.args[0]?.toLowerCase();
      if (!arg) {
        action = 'status';
      } else if (arg === 'on' || arg === 'enable') {
        action = 'enable';
      } else if (arg === 'off' || arg === 'disable') {
        action = 'disable';
      } else if (arg === 'rate') {
        action = 'rate';
        rate = parseInt(ctx.args[1], 10);
      } else {
        return ctx.reply(panelReply(buildUsagePanel(ctx, {
          title: 'Voice XP Settings',
          problem: 'Use `on`, `off`, or `rate <xp>`.',
          commandName: COMMAND_NAME,
          usage: COMMAND_USAGE,
          examples: ['voicexp on', 'voicexp off', 'voicexp rate 12'],
        })));
      }
    }

    if (action === 'status') {
      return ctx.reply(panelReply(buildStatusPanel(ctx, GuildService.getSettings(ctx.guildId))));
    }

    if (action === 'rate' && (!Number.isInteger(rate) || rate < 1 || rate > 100)) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'Voice XP Settings',
        problem: 'The voice XP rate must be between 1 and 100 XP per minute.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['voicexp rate 12'],
      })));
    }

    const settings = GuildService.getSettings(ctx.guildId);
    // Handle enable/disable with already‑state feedback
    if (action === 'enable') {
      if (settings?.voice_xp_enabled) {
        return ctx.reply(panelReply(buildUsagePanel(ctx, {
          title: 'Voice XP Settings',
          problem: 'Voice XP is already **enabled**. Use `voicexp disable` to turn it off.',
          commandName: COMMAND_NAME,
          usage: COMMAND_USAGE,
          examples: ['voicexp enable', 'voicexp disable'],
        })));
      }
      GuildService.setVoiceXP(ctx.guildId, true);
    } else if (action === 'disable') {
      if (!settings?.voice_xp_enabled) {
        return ctx.reply(panelReply(buildUsagePanel(ctx, {
          title: 'Voice XP Settings',
          problem: 'Voice XP is already **disabled**. Use `voicexp enable` to turn it on.',
          commandName: COMMAND_NAME,
          usage: COMMAND_USAGE,
          examples: ['voicexp enable', 'voicexp disable'],
        })));
      }
      GuildService.setVoiceXP(ctx.guildId, false);
    } else {
      GuildService.setVoiceXPRate(ctx.guildId, rate);
    }

    const updatedSettings = GuildService.getSettings(ctx.guildId);

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'Voice XP Updated',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: action === 'disable' ? PANEL_ACCENTS.warning : PANEL_ACCENTS.cyan,
      thumbnailUrl: getSystemThumbnail(ctx),
      sections: [
        {
          title: 'Voice Progression',
          icon: emoji.aerox.voice,
          lines: [
            `- Enabled: **${(updatedSettings?.voice_xp_enabled ?? 1) ? 'Yes' : 'No'}**`,
            `- ate: **${updatedSettings?.voice_xp_per_min ?? 10} XP/min**`,
            `- Updated: **${action === 'rate' ? 'Rate' : action === 'enable' ? 'Enabled' : action === 'disable' ? 'Disabled' : 'Status'}**`,
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
