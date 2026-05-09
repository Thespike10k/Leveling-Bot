// AeroX Leveling System — Made By Joshhhhh
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { emoji } from '#utils/emoji';
import { Command } from '#structures/classes/Command';
import { GuildService } from '../../database/services/GuildService.js';
import {
  buildLevelPanel,
  buildPermissionPanel,
  getSystemFooter,
  getSystemThumbnail,
  panelReply,
  PANEL_ACCENTS,
} from './_panel.js';

const COMMAND_NAME = 'xpconfig';
const DEFAULT_LEVEL_MESSAGE = '{mention} leveled up to **Level {level}**! 🎉';

function formatDestination(settings) {
  if (settings?.level_up_dm) return 'Direct Messages';
  if (settings?.level_up_channel) return `<#${settings.level_up_channel}>`;
  return 'Current channel';
}

function clip(value, max = 80) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function buildXPPayload(ctx, settings, lastUpdate = null) {
  const rewards = GuildService.listRewards(ctx.guildId);
  const multipliers = GuildService.getMultipliers(ctx.guildId);
  const blacklist = GuildService.getBlacklist(ctx.guildId);

  const container = buildLevelPanel({
    title: 'XP Configuration',
    subtitle: ctx.guild?.name ?? 'Server Controls',
    accentColor: PANEL_ACCENTS.gold,
    thumbnailUrl: getSystemThumbnail(ctx),
    sections: [
      lastUpdate ? {
        title: 'Status',
        icon: emoji.aerox.check,
        lines: [`> **${lastUpdate}**`],
      } : null,
      {
        title: 'Server Setup',
        icon: emoji.aerox.settings,
        lines: [
          `- Prefix: \`${settings?.prefix ?? '!'}\``,
          `- Rewards Configured: **${rewards.length}**`,
          `- Multipliers: **${multipliers.length}**`,
          `- Blacklist Entries: **${blacklist.length}**`,
        ],
      },
      {
        title: 'Message XP',
        icon: '💬',
        lines: [
          `- Range: **${settings?.xp_min ?? 15}-${settings?.xp_max ?? 40} XP**`,
          `- Cooldown: **${settings?.xp_cooldown_secs ?? 60}s**`,
          `- Stack Rewards: **${(settings?.stack_rewards ?? 1) ? 'Enabled' : 'Disabled'}**`,
        ],
      },
      {
        title: 'Level-Up Announcements',
        icon: '📣',
        lines: [
          `- Enabled: **${(settings?.level_up_enabled ?? 1) ? 'Yes' : 'No'}**`,
          `- Destination: **${formatDestination(settings)}**`,
          `- Message: \`${clip(settings?.level_up_message ?? DEFAULT_LEVEL_MESSAGE)}\``,
        ],
      },
      {
        title: 'Voice XP',
        icon: emoji.aerox.voice,
        lines: [
          `- Enabled: **${(settings?.voice_xp_enabled ?? 1) ? 'Yes' : 'No'}**`,
          `- Rate: **${settings?.voice_xp_per_min ?? 10} XP/min**`,
        ],
      },
    ],
    footer: getSystemFooter(ctx),
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('xp_config_select')
    .setPlaceholder('Select a setting to configure...')
    .addOptions([
      {
        label: 'Update Min XP',
        description: `Current: ${settings?.xp_min ?? 15} XP`,
        value: 'config_min_xp',
        emoji: emoji.aerox.add,
      },
      {
        label: 'Update Max XP',
        description: `Current: ${settings?.xp_max ?? 40} XP`,
        value: 'config_max_xp',
        emoji: emoji.aerox.add,
      },
      {
        label: 'Update XP Cooldown',
        description: `Current: ${settings?.xp_cooldown_secs ?? 60}s`,
        value: 'config_cooldown',
        emoji: emoji.aerox.clock,
      },
      {
        label: 'Update Voice XP Rate',
        description: `Current: ${settings?.voice_xp_per_min ?? 10} XP/min`,
        value: 'config_voice_rate',
        emoji: emoji.aerox.voice,
      },
    ]);

  container.addActionRowComponents(new ActionRowBuilder().addComponents(select));

  return [container];
}

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: 'View and manage the XP configuration for this server',
  category: 'Admin',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('View and manage the XP configuration for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(ctx) {
    if (!ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply(panelReply(buildPermissionPanel(ctx, {
        commandName: COMMAND_NAME,
        permissionLabel: 'Manage Server',
      })));
    }

    let settings = GuildService.getSettings(ctx.guildId);
    let lastStatus = null;
    const sent = await ctx.reply({
      components: buildXPPayload(ctx, settings, lastStatus),
      flags: MessageFlags.IsComponentsV2,
    });

    const collectorOptions = {
      filter: (i) => i.user.id === ctx.author.id,
      time: 3 * 60 * 1000,
    };
    const collector = sent.createMessageComponentCollector(collectorOptions);

    collector.on('collect', async (i) => {
      if (i.customId === 'xp_config_select') {
        const value = i.values[0];
        let label = '';
        let placeholder = '';
        let currentValue = '';

        if (value === 'config_min_xp') {
          label = 'Minimum XP per Message';
          placeholder = 'Enter a number (e.g. 15)';
          currentValue = String(settings?.xp_min ?? 15);
        } else if (value === 'config_max_xp') {
          label = 'Maximum XP per Message';
          placeholder = 'Enter a number (e.g. 40)';
          currentValue = String(settings?.xp_max ?? 40);
        } else if (value === 'config_cooldown') {
          label = 'XP Cooldown (in seconds)';
          placeholder = 'Enter a number (e.g. 60)';
          currentValue = String(settings?.xp_cooldown_secs ?? 60);
        } else if (value === 'config_voice_rate') {
          label = 'Voice XP Rate (XP per minute)';
          placeholder = 'Enter a number (e.g. 10)';
          currentValue = String(settings?.voice_xp_per_min ?? 10);
        }

        const modal = new ModalBuilder()
          .setCustomId('xp_config_modal')
          .setTitle('Update Settings');

        const input = new TextInputBuilder()
          .setCustomId('xp_config_input')
          .setLabel(label)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(placeholder)
          .setValue(currentValue)
          .setRequired(true)
          .setMaxLength(5);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await i.showModal(modal).catch(() => {});

        const submitted = await i.awaitModalSubmit({
          time: 60000,
          filter: (mi) => mi.customId === 'xp_config_modal' && mi.user.id === i.user.id,
        }).catch(() => null);

        if (submitted) {
          const val = parseInt(submitted.fields.getTextInputValue('xp_config_input'), 10);
          if (isNaN(val) || val < 0) {
            return submitted.reply({
              content: `${emoji.aerox.cross} Please enter a valid positive number!`,
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
          }

          let logKey = '';
          if (value === 'config_min_xp') {
            GuildService.setXPRange(ctx.guildId, val, settings?.xp_max ?? 40);
            logKey = 'Minimum XP';
          } else if (value === 'config_max_xp') {
            GuildService.setXPRange(ctx.guildId, settings?.xp_min ?? 15, val);
            logKey = 'Maximum XP';
          } else if (value === 'config_cooldown') {
            GuildService.setXPCooldown(ctx.guildId, val);
            logKey = 'XP Cooldown';
          } else if (value === 'config_voice_rate') {
            GuildService.setVoiceXPRate(ctx.guildId, val);
            logKey = 'Voice XP Rate';
          }

          lastStatus = `Successfully updated ${logKey} to ${val}!`;
          settings = GuildService.getSettings(ctx.guildId);
          
          await submitted.deferUpdate().catch(() => {});
          const updatePayload = {
            components: buildXPPayload(ctx, settings, lastStatus),
            flags: MessageFlags.IsComponentsV2,
          };

          if (ctx.isSlash) await ctx.interaction.editReply(updatePayload).catch(() => {});
          else if (sent.editable) await sent.edit(updatePayload).catch(() => {});
        }
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'messageDelete') return;
      
      const endPayload = {
        components: buildXPPayload(ctx, settings, lastStatus),
        flags: MessageFlags.IsComponentsV2,
      };

      endPayload.components = endPayload.components.map(container => {
        container.components.forEach(comp => {
          if (comp instanceof ActionRowBuilder || comp.components) {
            comp.components.forEach(child => child.setDisabled?.(true));
          }
        });
        return container;
      });
      
      if (sent.editable) await sent.edit(endPayload).catch(() => {});
      else if (ctx.isSlash) await ctx.interaction.editReply(endPayload).catch(() => {});
    });
  },
});
