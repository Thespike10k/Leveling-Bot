import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
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
import { emoji } from '#utils/emoji';

const COMMAND_NAME = 'xpblacklist';
const COMMAND_USAGE = '<add | remove | list> <channel | role | user> <target>';
const VALID_TYPES = new Set(['channel', 'role', 'user']);

function cleanId(raw = '') {
  return raw.replace(/[<#@!&>]/g, '');
}

function formatTarget(type, targetId) {
  if (type === 'channel') return `<#${targetId}>`;
  if (type === 'role') return `<@&${targetId}>`;
  return `<@${targetId}>`;
}

function resolvePrefixTarget(ctx, type, rawTarget) {
  if (type === 'channel') {
    const channel = ctx.message?.mentions?.channels?.first();
    return channel?.id ?? cleanId(rawTarget);
  }

  if (type === 'role') {
    const role = ctx.message?.mentions?.roles?.first();
    return role?.id ?? cleanId(rawTarget);
  }

  const user = ctx.message?.mentions?.users?.first();
  return user?.id ?? cleanId(rawTarget);
}

function buildListLines(entries) {
  const icons = { channel: '📺', role: '🏷️', user: '👤' };

  return entries
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type) || a.target_id.localeCompare(b.target_id))
    .map(entry => `${icons[entry.type]} **${entry.type}**: ${formatTarget(entry.type, entry.target_id)}`);
}

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: 'Blacklist channels, roles, or users from earning XP',
  usage: COMMAND_USAGE,
  category: 'Admin',
  cooldown: 3,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Manage XP blacklists')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('add').setDescription('Add a blacklist entry')
      .addStringOption(o => o.setName('type').setDescription('Entry type').setRequired(true)
        .addChoices(
          { name: 'Channel', value: 'channel' },
          { name: 'Role', value: 'role' },
          { name: 'User', value: 'user' },
        ))
      .addStringOption(o => o.setName('target').setDescription('Mention or raw ID').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a blacklist entry')
      .addStringOption(o => o.setName('type').setDescription('Entry type').setRequired(true)
        .addChoices(
          { name: 'Channel', value: 'channel' },
          { name: 'Role', value: 'role' },
          { name: 'User', value: 'user' },
        ))
      .addStringOption(o => o.setName('target').setDescription('Mention or raw ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('Show all blacklist entries')),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        permissionLabel: 'Manage Server',
        examples: ['xpblacklist add channel #general', 'xpblacklist add user @user', 'xpblacklist list'],
      })));
    }

    let action;
    let type;
    let targetId;

    if (ctx.isSlash) {
      action = ctx.interaction.options.getSubcommand();
      if (action !== 'list') {
        type = ctx.interaction.options.getString('type');
        targetId = cleanId(ctx.interaction.options.getString('target'));
      }
    } else {
      action = ctx.args[0]?.toLowerCase() ?? 'list';
      if (action !== 'list') {
        type = ctx.args[1]?.toLowerCase();
        targetId = resolvePrefixTarget(ctx, type, ctx.args[2]);
      }
    }

    const currentEntries = GuildService.getBlacklist(ctx.guildId);

    if (action === 'list') {
      if (!currentEntries.length) {
        return ctx.reply(panelReply(buildUsagePanel(ctx, {
          title: 'XP Blacklist',
          problem: 'No blacklist entries are configured for this server.',
          commandName: COMMAND_NAME,
          usage: COMMAND_USAGE,
          examples: ['xpblacklist add channel #general', 'xpblacklist add role @muted'],
          note: 'Use the add action to block XP in specific channels, roles, or users.',
          accentColor: PANEL_ACCENTS.info,
        })));
      }

      return ctx.reply(panelReply(buildLevelPanel({
        title: 'XP Blacklist',
        subtitle: ctx.guild?.name ?? 'Server Controls',
        accentColor: PANEL_ACCENTS.warning,
        thumbnailUrl: getSystemThumbnail(ctx),
        sections: [
          {
            title: 'Blocked Targets',
            icon: emoji.aerox.cross,
            lines: buildListLines(currentEntries),
          },
        ],
        footer: getSystemFooter(ctx),
      })));
    }

    if (!['add', 'remove'].includes(action) || !VALID_TYPES.has(type) || !targetId) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Blacklist',
        problem: 'Provide a valid action, type, and target.',
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['xpblacklist add channel #general', 'xpblacklist remove user @user', 'xpblacklist list'],
      })));
    }

    const targetLabel = formatTarget(type, targetId);
    const exists = currentEntries.some(entry => entry.type === type && entry.target_id === targetId);

    if (action === 'add' && exists) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Blacklist',
        problem: `${targetLabel} is already blacklisted.`,
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['xpblacklist add channel #general'],
      })));
    }

    if (action === 'remove' && !exists) {
      return ctx.reply(panelReply(buildUsagePanel(ctx, {
        title: 'XP Blacklist',
        problem: `${targetLabel} is not currently blacklisted.`,
        commandName: COMMAND_NAME,
        usage: COMMAND_USAGE,
        examples: ['xpblacklist remove channel #general'],
      })));
    }

    if (action === 'add') {
      GuildService.addBlacklist(ctx.guildId, targetId, type);
    } else {
      GuildService.removeBlacklist(ctx.guildId, targetId, type);
    }

    return ctx.reply(panelReply(buildLevelPanel({
      title: action === 'add' ? 'Blacklist Entry Added' : 'Blacklist Entry Removed',
      subtitle: ctx.guild?.name ?? 'Server Controls',
      accentColor: action === 'add' ? PANEL_ACCENTS.warning : PANEL_ACCENTS.success,
      thumbnailUrl: getSystemThumbnail(ctx),
      sections: [
        {
          title: 'XP Restriction',
          icon: action === 'add' ? emoji.aerox.cross : emoji.aerox.check,
          lines: [
            `- Type: **${type}**`,
            `- Target: ${targetLabel}`,
            `- Action: **${action}**`,
          ],
        },
      ],
      footer: getSystemFooter(ctx),
    })));
  },
});
