// AeroX Leveling System — Made By Joshhhhh
import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Command } from '#structures/classes/Command';
import { emoji } from '#utils/emoji';
import { UserService } from '../../database/services/UserService.js';
import { formatXP, formatDuration } from '#utils';
import { rejectForeignInteraction } from './_interactions.js';

const PAGE_SIZE = 10;
const COLLECTOR_TIMEOUT = 60_000;

function formatRankBadge(rank) {
  return emoji.aerox.medal(rank);
}

function formatEntry(entry, position, type) {
  const badge = position <= 3 ? emoji.aerox.medal(position) : `\`${position}.\``;
  
  if (type === 'voice') {
    return [
      `${badge} <@${entry.user_id}> - Time: ${formatDuration(entry.total_voice_secs || entry.voice_secs || 0)}`,
      `> Level: ${entry.level ?? 0}  •  XP: ${formatXP(entry.xp ?? 0)}`,
    ].join('\n');
  }

  if (type === 'message') {
    return [
      `${badge} <@${entry.user_id}> - Messages: ${entry.messages ?? 0}`,
      `> Level: ${entry.level ?? 0}  •  XP: ${formatXP(entry.xp ?? 0)}`,
    ].join('\n');
  }

  // Default: XP/Level mode
  return [
    `${badge} <@${entry.user_id}> - Level ${entry.level ?? 0}`,
    `> XP: ${formatXP(entry.xp ?? 0)}`,
  ].join('\n');
}

async function findTargetIndex(entries, query, ctx) {
  const mentionMatch = query.match(/^<@!?(\d+)>$/);
  const cleanQuery = mentionMatch ? mentionMatch[1] : query;

  const byId = entries.findIndex(e => e.user_id === cleanQuery);
  if (byId !== -1) return byId;

  const normalized = cleanQuery.toLowerCase();
  const indexByUserId = new Map(entries.map((entry, index) => [entry.user_id, index]));

  if (ctx.guild) {
    try {
      const members = await ctx.guild.members.fetch({
        query: cleanQuery,
        limit: Math.min(entries.length, 100),
        time: 10_000,
      });

      for (const member of members.values()) {
        const username = member.user.username.toLowerCase();
        const globalName = member.user.globalName?.toLowerCase();
        const displayName = member.displayName?.toLowerCase();
        if (
          indexByUserId.has(member.id) &&
          (username === normalized || globalName === normalized || displayName === normalized)
        ) {
          return indexByUserId.get(member.id);
        }
      }
    } catch { }
  }

  for (let i = 0; i < entries.length; i++) {
    try {
      const member = ctx.guild?.members.cache.get(entries[i].user_id);
      if (member) {
        const username = member.user.username.toLowerCase();
        const globalName = member.user.globalName?.toLowerCase();
        const displayName = member.displayName?.toLowerCase();
        if (username === normalized || globalName === normalized || displayName === normalized) {
          return i;
        }
      }

      const user = await ctx.client.users.fetch(entries[i].user_id);
      const username = user.username.toLowerCase();
      const globalName = user.globalName?.toLowerCase();
      if (username === normalized || globalName === normalized) {
        return i;
      }
    } catch { }
  }

  return -1;
}

function buildRankSection(callerRank, callerProfile, callerAvatarURL, type) {
  const contentLines = [
    `**My Rank:** ${formatRankBadge(callerRank)}`,
  ];

  if (type === 'voice') {
    contentLines.push(`> Time: ${formatDuration(callerProfile?.totalVoiceSecs ?? 0)}`);
  } else if (type === 'message') {
    contentLines.push(`> Messages: ${callerProfile?.messages ?? 0}`);
  }

  contentLines.push(`> Level: ${callerProfile?.computedLevel ?? 0}`);
  contentLines.push(`> XP: ${formatXP(callerProfile?.xp ?? 0)}`);

  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(contentLines.join('\n'))
  );

  if (callerAvatarURL) {
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(callerAvatarURL)
    );
  }

  return section;
}

function buildPage(entries, page, totalPages, callerRank, callerProfile, type, guildName, callerAvatarURL) {
  const start = page * PAGE_SIZE;
  const slice = entries.slice(start, start + PAGE_SIZE);
  const rows = slice.map((entry, index) => formatEntry(entry, start + index + 1, type));

  let title = `# ${emoji.aerox.trophy} Server Leaderboard`;
  if (type === 'voice') title = `# ${emoji.aerox.trophy} Voice Leaderboard`;
  else if (type === 'message') title = `# ${emoji.aerox.trophy} Message Leaderboard`;

  return new ContainerBuilder()
    .setAccentColor(0xffffff)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addSectionComponents(buildRankSection(callerRank, callerProfile, callerAvatarURL, type))
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        rows.join('\n\n') || `> No data yet.`
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('lb_back')
          .setLabel(`Back`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('lb_find')
          .setLabel(`🔍 Find`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('lb_next')
          .setLabel(`Next`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      )
    );
}

function disabledPage(entries, page, totalPages, callerRank, callerProfile, type, guildName, callerAvatarURL) {
  const start = page * PAGE_SIZE;
  const slice = entries.slice(start, start + PAGE_SIZE);
  const rows = slice.map((entry, index) => formatEntry(entry, start + index + 1, type));

  let title = `# ${emoji.aerox.trophy} Server Leaderboard`;
  if (type === 'voice') title = `# ${emoji.aerox.trophy} Voice Leaderboard`;
  else if (type === 'message') title = `# ${emoji.aerox.trophy} Message Leaderboard`;

  return new ContainerBuilder()
    .setAccentColor(0xffffff)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addSectionComponents(buildRankSection(callerRank, callerProfile, callerAvatarURL, type))
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        rows.join('\n\n') || `> No data yet.`
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('lb_back')
          .setLabel(`Back`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('lb_find')
          .setLabel(`🔍 Find`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('lb_next')
          .setLabel(`Next`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      )
    );
}

export const command = new Command({
  name: 'leaderboard',
  aliases: ['lb'],
  description: 'View the server level, message, or voice leaderboard',
  usage: '[level/message/voice]',
  category: 'Leveling',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server level, message, or voice leaderboard')
    .addSubcommand(sub =>
      sub.setName('level').setDescription('View the server XP/Level leaderboard')
    )
    .addSubcommand(sub =>
      sub.setName('m').setDescription('View the server message count leaderboard')
    )
    .addSubcommand(sub =>
      sub.setName('vc').setDescription('View the server voice leaderboard')
    ),

  async execute(ctx) {
    UserService.ensure(ctx.userId, ctx.guildId);

    const sub = ctx.isSlash ? ctx.interaction.options.getSubcommand(false) : ctx.args[0]?.toLowerCase();
    
    let type = 'xp';
    if (['voice', 'vc'].includes(sub)) type = 'voice';
    else if (['message', 'm'].includes(sub)) type = 'message';

    let entries = [];
    if (type === 'voice') entries = UserService.voiceLeaderboard(ctx.guildId, 200);
    else if (type === 'message') entries = UserService.messageLeaderboard(ctx.guildId, 200);
    else entries = UserService.leaderboard(ctx.guildId, 200);

    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const callerIdx = entries.findIndex(e => e.user_id === ctx.userId);
    const callerRank = callerIdx >= 0 ? callerIdx + 1 : 9999;
    const callerProfile = UserService.getProfile(ctx.userId, ctx.guildId);
    const guildName = ctx.guild?.name ?? 'Server';
    const callerAvatarURL =
      ctx.member?.displayAvatarURL?.({ size: 64, extension: 'png' })
      ?? ctx.author?.displayAvatarURL?.({ size: 64, extension: 'png' })
      ?? null;

    let page = 0;

    const sent = await ctx.reply({
      components: [
        buildPage(entries, page, totalPages, callerRank, callerProfile, type, guildName, callerAvatarURL),
      ],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
      fetchReply: true,
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_TIMEOUT,
    });

    collector.on('collect', async interaction => {
      if (await rejectForeignInteraction(interaction, ctx.userId)) return;

      if (interaction.customId === 'lb_back') {
        page = Math.max(0, page - 1);
        await interaction.update({
          components: [buildPage(entries, page, totalPages, callerRank, callerProfile, type, guildName, callerAvatarURL)],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        });
      } else if (interaction.customId === 'lb_next') {
        page = Math.min(totalPages - 1, page + 1);
        await interaction.update({
          components: [buildPage(entries, page, totalPages, callerRank, callerProfile, type, guildName, callerAvatarURL)],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        });
      } else if (interaction.customId === 'lb_find') {
        const modal = new ModalBuilder()
          .setCustomId('lb_find_modal')
          .setTitle('Find User in Leaderboard')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('lb_find_input')
                .setLabel('User ID or Name')
                .setPlaceholder('Enter ID or exact name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );

        await interaction.showModal(modal);

        const modalSubmit = await interaction
          .awaitModalSubmit({
            filter: m => m.customId === 'lb_find_modal' && m.user.id === ctx.userId,
            time: 30_000,
          })
          .catch(() => null);

        if (!modalSubmit) return;

        await modalSubmit.deferReply({ flags: MessageFlags.Ephemeral });

        const query = modalSubmit.fields.getTextInputValue('lb_find_input').trim();
        const targetIdx = await findTargetIndex(entries, query, ctx);

        if (targetIdx === -1) {
          await modalSubmit.editReply({
            content: `${emoji.aerox.cross} No user matching **${query}** was found in the leaderboard.`,
            allowedMentions: { parse: [] },
          });
          return;
        }

        const targetRank = targetIdx + 1;
        const targetEntry = entries[targetIdx];
        const targetPage = Math.floor(targetIdx / PAGE_SIZE);

        const rankBadge = emoji.aerox.medal(targetRank);

        page = targetPage;

        await sent.edit({
          components: [buildPage(entries, page, totalPages, callerRank, callerProfile, type, guildName, callerAvatarURL)],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        });

        let findVal = `Level **${targetEntry.level ?? 0}**  •  XP: ${formatXP(targetEntry.xp ?? 0)}`;
        if (type === 'voice') findVal = `Time: **${formatDuration(targetEntry.total_voice_secs || targetEntry.voice_secs || 0)}**`;
        else if (type === 'message') findVal = `Messages: **${targetEntry.messages ?? 0}**`;

        await modalSubmit.editReply({
          content: [
            `${emoji.aerox.info} **Found:** <@${targetEntry.user_id}>`,
            `> Rank: **${rankBadge}**  •  ${findVal}`,
          ].join('\n'),
          allowedMentions: { parse: [] },
        });
      }
    });

    collector.on('end', async () => {
      try {
        await sent.edit({
          components: [disabledPage(entries, page, totalPages, callerRank, callerProfile, type, guildName, callerAvatarURL)],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        });
      } catch { }
    });
  },
});
