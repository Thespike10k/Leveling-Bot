// AeroX Leveling System — Made By Joshhhhh
import { PermissionFlagsBits, SlashCommandBuilder, ActionRowBuilder, ChannelType } from 'discord.js';
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

const COMMAND_NAME = 'multiplier';
const COMMAND_USAGE = '<set | remove | list> <channel | role> <target> [multiplier]';
const VALID_TYPES = new Set(['channel', 'role']);

function cleanId(raw = '') {
  return raw.replace(/[<#@&>]/g, '');
}

function resolvePrefixTarget(ctx, type, rawTarget) {
  if (type === 'channel') {
    const channel = ctx.message?.mentions?.channels?.first();
    return channel?.id ?? cleanId(rawTarget);
  }

  const role = ctx.message?.mentions?.roles?.first();
  return role?.id ?? cleanId(rawTarget);
}

function formatTarget(type, targetId) {
  return type === 'channel' ? `<#${targetId}>` : `<@&${targetId}>`;
}

function buildListLines(entries) {
  const icons = { channel: '📺', role: '🏷️' };

  return entries
    .slice()
    .sort((a, b) => b.multiplier - a.multiplier || a.type.localeCompare(b.type))
    .map(entry => `${icons[entry.type]} ${formatTarget(entry.type, entry.target_id)} → **${entry.multiplier}x**`);
}

export const command = new Command({
  name: COMMAND_NAME,
  aliases: ['mult'],
  description: 'Set XP multipliers for channels and roles',
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 3,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Manage XP multipliers for channels and roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('set').setDescription('Set an XP multiplier')
      .addStringOption(o => o.setName('type').setDescription('Target type').setRequired(true)
        .addChoices({ name: 'Channel', value: 'channel' }, { name: 'Role', value: 'role' }))
      .addStringOption(o => o.setName('target').setDescription('Search for a channel or role...').setRequired(true).setAutocomplete(true))
      .addNumberOption(o => o.setName('multiplier').setDescription('Multiplier value').setMinValue(0.1).setMaxValue(10).setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove an XP multiplier')
      .addStringOption(o => o.setName('type').setDescription('Target type').setRequired(true)
        .addChoices({ name: 'Channel', value: 'channel' }, { name: 'Role', value: 'role' }))
      .addStringOption(o => o.setName('target').setDescription('Search for a channel or role...').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('Show all XP multipliers')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'target') {
      const type = interaction.options.getString('type');
      const query = focused.value.toLowerCase();

      if (type === 'channel') {
        const channels = interaction.guild.channels.cache
          .filter(ch => [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(ch.type) && ch.name.toLowerCase().includes(query))
          .first(25);
        return interaction.respond(channels.map(ch => ({ name: `#${ch.name}`, value: ch.id })));
      } else if (type === 'role') {
        const roles = interaction.guild.roles.cache
          .filter(r => r.name !== '@everyone' && !r.managed && r.name.toLowerCase().includes(query))
          .first(25);
        return interaction.respond(roles.map(r => ({ name: r.name, value: r.id })));
      }
    }
    await interaction.respond([]);
  },

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['multiplier set channel #general 2', 'multiplier set role @vip 1.5', 'multiplier list'],
      })));
    }

    let action;
    let type;
    let targetId;
    let multiplier = null;

    if (ctx.isSlash) {
      action = ctx.interaction.options.getSubcommand();
      if (action !== 'list') {
        type = ctx.interaction.options.getString('type');
        targetId = cleanId(ctx.interaction.options.getString('target'));
      }
      if (action === 'set') {
        multiplier = ctx.interaction.options.getNumber('multiplier');
      }
    } else {
      action = ctx.args[0]?.toLowerCase() ?? 'list';
      if (action !== 'list') {
        type = ctx.args[1]?.toLowerCase();
        targetId = resolvePrefixTarget(ctx, type, ctx.args[2]);
      }
      if (action === 'set') {
        multiplier = Number.parseFloat(ctx.args[3]);
      }
    }

    const currentEntries = GuildService.getMultipliers(ctx.guildId);

    if (action === 'list') {
      if (!currentEntries.length) {
        return ctx.reply(panelReply(buildUsagePanel(ctx, {
          title: 'XP Multipliers',
          problem: 'No channel or role multipliers are configured yet.',
          commandName: COMMAND_NAME,
          usage: COMMAND_USAGE,
          examples: ['multiplier set channel #general 2', 'multiplier set role @vip 1.5'],
          note: 'Use multipliers to boost XP in special channels or for specific roles.',
          accentColor: PANEL_ACCENTS.info,
        })));
      }

      return ctx.reply(panelReply(buildLevelPanel({
        title: 'XP Multipliers',
        subtitle: ctx.guild?.name ?? 'Server Controls',
        accentColor: PANEL_ACCENTS.cyan,
        thumbnailUrl: getSystemThumbnail(ctx),
        sections: [
          {
            title: 'Active Boosts',
            icon: emoji.aerox.bolt,
            lines: buildListLines(currentEntries),
          },
        ],
        footer: getSystemFooter(ctx),
      })));
    }

    if (!['set', 'remove'].includes(action) || !VALID_TYPES.has(type) || !targetId) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Multipliers',
        problem: 'Provide a valid action, type, and target.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['multiplier set channel #general 2', 'multiplier remove role @vip', 'multiplier list'],
      })));
    }

    if (action === 'set' && (!Number.isFinite(multiplier) || multiplier < 0.1 || multiplier > 10)) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Multipliers',
        problem: 'The multiplier must be between 0.1x and 10x.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['multiplier set channel #general 2'],
      })));
    }

    const targetLabel = formatTarget(type, targetId);
    const existing = currentEntries.find(entry => entry.type === type && entry.target_id === targetId);

    if (action === 'remove' && !existing) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Multipliers',
        problem: `${targetLabel} does not have an XP multiplier yet.`,
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['multiplier remove channel #general'],
      })));
    }

    if (action === 'set') {
      GuildService.setMultiplier(ctx.guildId, targetId, type, multiplier);
    } else {
      GuildService.setMultiplier(ctx.guildId, targetId, type, 0);
    }

    return ctx.reply(panelReply(buildLevelPanel({
      title: action === 'set' ? 'XP Multiplier Updated' : 'XP Multiplier Removed',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: action === 'set' ? PANEL_ACCENTS.cyan : PANEL_ACCENTS.success,
      thumbnailUrl: getSystemThumbnail(ctx),
      sections: [
        {
          title: 'Boost Target',
          icon: action === 'set' ? emoji.aerox.chart : '🧹',
          lines: [
            `- Type: **${type}**`,
            `- Target: ${targetLabel}`,
            ...(action === 'set' ? [`• Multiplier: **${multiplier}x**`] : []),
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
