import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} from 'discord.js';
import { Command } from '#structures/classes/Command';
import { LogRepository } from '../../database/repositories/LogRepository.js';
import { UserRepository } from '../../database/repositories/UserRepository.js';
import { formatDuration } from '#utils';
import { rejectForeignInteraction } from './_interactions.js';
import { emoji } from '#utils/emoji';

const WINDOWS = [
  { label: '1d', seconds: 86_400 },
  { label: '7d', seconds: 7 * 86_400 },
  { label: '14d', seconds: 14 * 86_400 },
  { label: '30d', seconds: 30 * 86_400 },
];
const MODE_ACTUAL = 'actual';
const MODE_VALID = 'valid';
const VIEW_OVERVIEW = 'overview';
const VIEW_HISTORY = 'history';
const TOP_LIMIT = 3;
const COLLECTOR_TIMEOUT = 90_000;
const ACCENT_COLORS = {
  [MODE_ACTUAL]: 0xffffff,
  [MODE_VALID]: 0xffffff,
};

function formatCount(value) {
  return String(Math.max(0, Math.floor(value)));
}

function buildTitle(mode) {
  return mode === MODE_VALID
    ? `# Server Valid Stats`
    : `# Server Stats`;
}

function buildToggleButton(mode) {
  return new ButtonBuilder()
    .setCustomId('ss_toggle_mode')
    .setLabel(mode === MODE_VALID ? `Show Actual` : `Show Valid`)
    .setStyle(mode === MODE_VALID ? ButtonStyle.Danger : ButtonStyle.Success);
}

function buildButtons(mode, view, disabled = false) {
  return new ActionRowBuilder().addComponents(
    buildToggleButton(mode).setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('ss_refresh')
      .setLabel(`Refresh`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(view === VIEW_HISTORY ? 'ss_back' : 'ss_history')
      .setLabel(view === VIEW_HISTORY ? `Back` : `History`)
      .setStyle(view === VIEW_HISTORY ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

function buildTopLines(entries, formatter) {
  if (!entries.length) return ['-# No tracked data yet.'];
  return entries.map((entry, index) => `${index + 1}. <@${entry.user_id}> - ${formatter(entry.value)}`);
}

function buildOverviewContainer(mode, stats, disabled = false) {
  return new ContainerBuilder()
    .setAccentColor(0xffffff)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(buildTitle(mode))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${emoji.aerox.chart} Totals`,
          `**Total Messages:** ${formatCount(stats.totalMessages)}`,
          `**Total Voice:** ${formatDuration(stats.totalVoiceSecs)}`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## 💬 Top Chatters',
          ...buildTopLines(stats.topChatters, value => formatCount(value)),
        ].join('\n')
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${emoji.aerox.voice} Top Speakers`,
          ...buildTopLines(stats.topSpeakers, value => formatDuration(value)),
        ].join('\n')
      )
    )
    .addActionRowComponents(buildButtons(mode, VIEW_OVERVIEW, disabled));
}

function buildHistoryContainer(mode, stats, disabled = false) {
  const textLines = stats.text.map(item => `• ${item.label} : ${formatCount(item.value)} msgs`);
  const voiceLines = stats.voice.map(item => `• ${item.label} : ${formatDuration(item.value)}`);

  return new ContainerBuilder()
    .setAccentColor(0xffffff)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(buildTitle(mode))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## 💬 Server Text History',
          ...textLines,
        ].join('\n')
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${emoji.aerox.voice} Server Voice History`,
          ...voiceLines,
        ].join('\n')
      )
    )
    .addActionRowComponents(buildButtons(mode, VIEW_HISTORY, disabled));
}

function computeHistoryStats(messageRows, voiceRows, nowTs, mode) {
  const text = WINDOWS.map(window => {
    const cutoff = nowTs - window.seconds;
    const count = messageRows.filter(row => row.ts >= cutoff).length;
    return { label: window.label, value: count };
  });

  const voice = WINDOWS.map(window => {
    const cutoff = nowTs - window.seconds;
    let totalSeconds = 0;

    for (const session of voiceRows) {
      if (mode === MODE_VALID && !session.left_at) continue;

      const sessionEnd = mode === MODE_VALID ? session.left_at : (session.left_at ?? nowTs);
      if (!sessionEnd) continue;

      const overlapStart = Math.max(session.joined_at, cutoff);
      const overlapEnd = Math.min(sessionEnd, nowTs);
      if (overlapEnd <= overlapStart) continue;

      totalSeconds += overlapEnd - overlapStart;
    }

    return { label: window.label, value: totalSeconds };
  });

  return { text, voice };
}

function fetchOverviewStats(guildId, mode, nowTs) {
  const totalMessages = LogRepository.guildMessageTotals(guildId)?.total_messages ?? 0;
  const topChatters = LogRepository.guildTopChatters(guildId, TOP_LIMIT)
    .map(entry => ({ user_id: entry.user_id, value: entry.total_messages }));

  if (mode === MODE_VALID) {
    const totalVoiceSecs = UserRepository.guildVoiceTotals(guildId)?.total_voice_secs ?? 0;
    const topSpeakers = UserRepository.topSpeakers(guildId, TOP_LIMIT)
      .map(entry => ({ user_id: entry.user_id, value: entry.voice_secs ?? ((entry.voice_mins ?? 0) * 60) }));

    return { totalMessages, totalVoiceSecs, topChatters, topSpeakers };
  }

  const totalVoiceSecs = LogRepository.guildActualVoiceTotals(guildId, nowTs)?.total_voice_secs ?? 0;
  const topSpeakers = LogRepository.guildActualTopSpeakers(guildId, nowTs, TOP_LIMIT)
    .map(entry => ({ user_id: entry.user_id, value: entry.total_voice_secs }));

  return { totalMessages, totalVoiceSecs, topChatters, topSpeakers };
}

function fetchHistoryStats(guildId, mode, nowTs) {
  const oldestCutoff = nowTs - WINDOWS.at(-1).seconds;
  const messageRows = LogRepository.guildMessageTimestampsSince(guildId, oldestCutoff);
  const voiceRows = LogRepository.guildVoiceSessionsSince(guildId, nowTs, oldestCutoff);

  return computeHistoryStats(messageRows, voiceRows, nowTs, mode);
}

function loadStats(guildId, mode) {
  const nowTs = Math.floor(Date.now() / 1000);

  return {
    overview: fetchOverviewStats(guildId, mode, nowTs),
    history: fetchHistoryStats(guildId, mode, nowTs),
  };
}

function buildCurrentView(mode, view, stats, disabled = false) {
  return view === VIEW_HISTORY
    ? buildHistoryContainer(mode, stats.history, disabled)
    : buildOverviewContainer(mode, stats.overview, disabled);
}

export const command = new Command({
  name: 'serverstats',
  aliases: ['ss'],
  description: 'View recent server text and voice activity',
  usage: '',
  category: 'Leveling',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('View recent server text and voice activity'),

  async execute(ctx) {
    let mode = MODE_ACTUAL;
    let view = VIEW_OVERVIEW;
    let currentStats = loadStats(ctx.guildId, mode);

    const reply = await ctx.reply({
      components: [buildCurrentView(mode, view, currentStats)],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_TIMEOUT,
    });

    collector.on('collect', async interaction => {
      if (await rejectForeignInteraction(interaction, ctx.userId)) return;

      if (interaction.customId === 'ss_toggle_mode') {
        mode = mode === MODE_VALID ? MODE_ACTUAL : MODE_VALID;
      } else if (interaction.customId === 'ss_history') {
        view = VIEW_HISTORY;
      } else if (interaction.customId === 'ss_back') {
        view = VIEW_OVERVIEW;
      }

      currentStats = loadStats(ctx.guildId, mode);

      await interaction.update({
        components: [buildCurrentView(mode, view, currentStats)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    });

    collector.on('end', async () => {
      try {
        await reply.edit({
          components: [buildCurrentView(mode, view, currentStats, true)],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        });
      } catch { }
    });
  },
});
