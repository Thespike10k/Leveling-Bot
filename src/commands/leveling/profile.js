// AeroX Leveling System — Made By Joshhhhh
import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} from 'discord.js';
import { Command } from '#structures/classes/Command';
import { emoji } from '#utils/emoji';
import { UserService } from '../../database/services/UserService.js';
import { formatDuration, formatXP } from '#utils';
import { rejectForeignInteraction } from './_interactions.js';

const COLLECTOR_TIMEOUT = 90_000;
const PAGE_OVERVIEW = 0;
const PAGE_HISTORY = 1;

function buildProgressBar(current, max, length = 10) {
  const safeMax = Math.max(1, max);
  const filled = Math.max(0, Math.min(length, Math.round((current / safeMax) * length)));
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

function formatRankBadge(rank) {
  return emoji.aerox.medal(rank);
}

function buildButtons(page, disabled = false) {
  const isOverview = page === PAGE_OVERVIEW;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('su_overview')
      .setLabel(`Overview`)
      .setStyle(isOverview ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(disabled || isOverview),
    new ButtonBuilder()
      .setCustomId('su_refresh')
      .setLabel(`Refresh`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('su_history')
      .setLabel(`History`)
      .setStyle(!isOverview ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(disabled || !isOverview),
  );
}

function buildOverview(member, targetUser, profile, textRank, voiceRank, actualVoiceSecs, disabled = false) {
  const joinedAgo = member?.joinedAt
    ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
    : 'Unknown';
  const xpInLevel = profile.xpForNext - profile.remainingXp;
  const pct = Math.floor((xpInLevel / Math.max(1, profile.xpForNext)) * 100);
  const bar = buildProgressBar(xpInLevel, profile.xpForNext, 10);
  const avatarURL =
    member?.displayAvatarURL?.({ size: 128, extension: 'png' })
    ?? targetUser.displayAvatarURL({ size: 128, extension: 'png' });

  return new ContainerBuilder()
    .setAccentColor(0xffffff)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `# ${emoji.aerox.chart} Profile Statistics`,
              `## ${emoji.aerox.level} Level : ${profile.computedLevel}`,
              `- **User :** <@${targetUser.id}>`,
              `- **Text Rank :** ${formatRankBadge(textRank)}`,
              `- **Voice Rank :** ${formatRankBadge(voiceRank)}`,
              `- **XP :** ${formatXP(xpInLevel)} / ${formatXP(profile.xpForNext)}`,
            ].join('\n')
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarURL)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
          [
            `**Progress:** \`${bar}\` ${pct}%`,
            `> Messages: ${profile.messages ?? 0} | Total XP: ${formatXP(profile.xp)}`,
            `> Voice: ${formatDuration(actualVoiceSecs)} | Joined: ${joinedAgo}`,
            `> Status: ${member?.presence?.status ?? 'Offline'}`,
          ].join('\n')
        )
    )
    .addActionRowComponents(buildButtons(PAGE_OVERVIEW, disabled));
}

function buildHistory(member, targetUser, profile, actualVoiceSecs, disabled = false) {
  const streakCur = profile.streak?.current ?? 0;
  const streakBest = profile.streak?.best ?? 0;
  const xpInLevel = profile.xpForNext - profile.remainingXp;
  const avatarURL =
    member?.displayAvatarURL?.({ size: 128, extension: 'png' })
    ?? targetUser.displayAvatarURL({ size: 128, extension: 'png' });

  return new ContainerBuilder()
    .setAccentColor(0xffffff)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `# ${emoji.aerox.chart} Profile Statistics`,
              `## ${emoji.aerox.leaderboard} History`,
              `- **User :** <@${targetUser.id}>`,
              `- **Current Streak :** ${streakCur} days`,
              `- **Best Streak :** ${streakBest} days`,
              `- **Last Active :** ${profile.streak?.last_day ?? 'N/A'}`,
            ].join('\n')
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarURL)
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**XP Breakdown:** ${formatXP(xpInLevel)} / ${formatXP(profile.xpForNext)}`,
          `> Total XP: ${formatXP(profile.xp)} | Level: ${profile.computedLevel}`,
          `> Messages: ${profile.messages ?? 0} | Voice: ${formatDuration(actualVoiceSecs)}`,
        ].join('\n')
      )
    )
    .addActionRowComponents(buildButtons(PAGE_HISTORY, disabled));
}

function buildProfileContainer(page, member, targetUser, profile, textRank, voiceRank, actualVoiceSecs, disabled = false) {
  return page === PAGE_OVERVIEW
    ? buildOverview(member, targetUser, profile, textRank, voiceRank, actualVoiceSecs, disabled)
    : buildHistory(member, targetUser, profile, actualVoiceSecs, disabled);
}

function getRankData(guildId, userId) {
  const leaderboard = UserService.leaderboard(guildId, 9999);
  const textRank = (leaderboard.findIndex(entry => entry.user_id === userId) + 1) || 9999;
  const voiceLeaderboard = UserService.voiceLeaderboard(guildId, 9999);
  const voiceRank = (voiceLeaderboard.findIndex(entry => entry.user_id === userId) + 1) || 9999;

  return { textRank, voiceRank };
}

export const command = new Command({
  name: 'profile',
  aliases: ['pr'],
  description: 'View detailed stats for you or another user',
  usage: '[@user]',
  category: 'Leveling',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View detailed stats for you or another user')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to check').setRequired(false)
    ),

  async execute(ctx) {
    const targetUser = ctx.isSlash
      ? (ctx.interaction.options.getUser('user') ?? ctx.author)
      : (ctx.message.mentions.users.first() ?? ctx.author);

    if (targetUser.bot) {
      const container = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${emoji.aerox.cross} Bots don't have profiles!`)
        );

      return ctx.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    }

    const member = ctx.guild?.members.cache.get(targetUser.id)
      ?? await ctx.guild?.members.fetch(targetUser.id).catch(() => null);

    UserService.ensure(targetUser.id, ctx.guildId);
    const profile = UserService.getProfile(targetUser.id, ctx.guildId);

    if (!profile) {
      const container = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${emoji.aerox.warning} No data found for **${targetUser.username}**.`)
        );

      return ctx.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    }

    let page = PAGE_OVERVIEW;

    const render = (currentProfile, disabled = false) => {
      const { textRank, voiceRank } = getRankData(ctx.guildId, targetUser.id);
      const actualVoiceSecs = UserService.getActualVoiceSeconds(targetUser.id, ctx.guildId);
      return buildProfileContainer(
        page,
        member,
        targetUser,
        currentProfile,
        textRank,
        voiceRank,
        actualVoiceSecs,
        disabled,
      );
    };

    const reply = await ctx.reply({
      components: [render(profile)],
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

      if (interaction.customId === 'su_overview') {
        page = PAGE_OVERVIEW;
      } else if (interaction.customId === 'su_history') {
        page = PAGE_HISTORY;
      } else if (interaction.customId === 'su_refresh') {
        UserService.ensure(targetUser.id, ctx.guildId);
      }

      const freshProfile = UserService.getProfile(targetUser.id, ctx.guildId) ?? profile;

      await interaction.update({
        components: [render(freshProfile)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    });

    collector.on('end', async () => {
      try {
        const finalProfile = UserService.getProfile(targetUser.id, ctx.guildId) ?? profile;
        await reply.edit({
          components: [render(finalProfile, true)],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        });
      } catch {}
    });
  },
});
