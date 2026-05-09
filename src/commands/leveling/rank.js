import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';
import { Command } from '#structures/classes/Command';
import { UserService } from '../../database/services/UserService.js';
import { LevelRewardsRepository } from '../../database/repositories/LevelRewardsRepository.js';
import { GuildSettingsRepository } from '../../database/repositories/GuildSettingsRepository.js';
import { emoji } from '#utils/emoji';
import { formatDuration, formatXP } from '#utils';

function buildProgressBar(current, max, length = 10) {
  const safeMax = Math.max(1, max);
  const filled = Math.max(0, Math.min(length, Math.round((current / safeMax) * length)));
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

async function generateRankCard(userTarget, level, xpInLevel, xpForNext, guildId) {
  const settings = GuildSettingsRepository.get(guildId) ?? {};
  const progress = Math.min(1, xpInLevel / xpForNext);
  const avatarURL = userTarget.displayAvatarURL({ size: 256, extension: 'png' });

  const canvas = createCanvas(661, 254);
  const ctx = canvas.getContext('2d');

  // Load background
  try {
    let bg;
    if (settings.level_up_background) {
      bg = await loadImage(settings.level_up_background).catch(() => null);
    }
    if (!bg) {
      const bgPath = path.resolve(process.cwd(), 'assets', 'levelbg.png');
      bg = await loadImage(bgPath);
    }
    if (bg) {
      ctx.drawImage(bg, 0, 0, 661, 254);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 661, 254);
    }
  } catch {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 661, 254);
  }

  // Overlay
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, 661, 254);

  // Avatar
  const avatar = await loadImage(avatarURL);
  const avatarSize = 110;
  const avatarX = 500;
  const avatarY = 70;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.stroke();

  // Progress bar
  const barX = 40;
  const barY = 40;
  const barW = 12;
  const barH = 170;

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 10);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(barX, barY + barH * (1 - progress), barW, barH * progress, 10);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('YOUR RANK', 70, 60);

  ctx.font = 'bold 22px sans-serif';
  let username = userTarget.username ?? 'User';
  const maxWidth = 320;
  if (ctx.measureText(username).width > maxWidth) {
    while (ctx.measureText(username + '...').width > maxWidth) {
      username = username.slice(0, -1);
    }
    username += '...';
  }
  ctx.fillText(username, 70, 95);

  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(`LVL ${level}`, 70, 150);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#dddddd';
  ctx.fillText(`${formatXP(xpInLevel)} / ${formatXP(xpForNext)} XP`, 70, 185);

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'rankcard.png' });
}

async function resolveRewardRole(ctx, level) {
  const rewards = LevelRewardsRepository.forLevel(ctx.guildId, level);
  const highestReward = rewards.at(-1);

  if (!highestReward || !ctx.guild) return null;

  return (
    ctx.guild.roles.cache.get(highestReward.role_id)
    ?? await ctx.guild.roles.fetch(highestReward.role_id).catch(() => null)
  );
}

export const command = new Command({
  name: 'rank',
  aliases: ['level', 'xp'],
  description: "View your or another user's rank card",
  usage: '[@user]',
  category: 'Leveling',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName('rank')
    .setDescription("View your or another user's rank card")
    .addUserOption(o =>
      o.setName('user').setDescription('The user to check').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.isSlash
      ? (ctx.interaction.options.getUser('user') ?? ctx.author)
      : (ctx.message.mentions.users.first() ?? ctx.author);

    if (target.bot) {
      const c = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${emoji.aerox.cross} Bots don't earn XP!`)
        );
      return ctx.reply({
        components: [c],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    }

    UserService.ensure(target.id, ctx.guildId);
    const profile = UserService.getProfile(target.id, ctx.guildId);

    if (!profile) {
      const c = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## ${emoji.aerox.warning} No data found for **${target.username}**.`
          )
        );
      return ctx.reply({
        components: [c],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    }

    const member = ctx.guild?.members.cache.get(target.id)
      ?? await ctx.guild?.members.fetch(target.id).catch(() => null);

    const xpInLevel = profile.xpForNext - profile.remainingXp;
    const pct = Math.floor((xpInLevel / Math.max(1, profile.xpForNext)) * 100);
    const bar = buildProgressBar(xpInLevel, profile.xpForNext, 10);
    const actualVoiceSecs = UserService.getActualVoiceSeconds(target.id, ctx.guildId);
    const rewardRole = await resolveRewardRole(ctx, profile.computedLevel);
    const roleLabel = rewardRole?.name ?? 'None';

    // Generate rank card image
    let rankCardAttachment = null;
    try {
      rankCardAttachment = await generateRankCard(target, profile.computedLevel, xpInLevel, profile.xpForNext, ctx.guildId);
    } catch (err) {
      console.error('[Rank Command] Error generating card:', err);
    }

    // Build container with card image
    const container = new ContainerBuilder()
      .setAccentColor(0xffffff);

    // Add rank card image
    if (rankCardAttachment) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL('attachment://rankcard.png')
        )
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );
    }

    // Add stats
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `# ${emoji.aerox.chart} Level Statistics`,
          `## ${emoji.aerox.level} Level : ${profile.computedLevel}`,
          `- **User :** <@${target.id}>`,
          `- **Rank :** #${profile.rank}`,
          `- **XP :** ${formatXP(xpInLevel)} / ${formatXP(profile.xpForNext)}`,
          `- **Role :** ${roleLabel}`,
          `\n**Progress:** \`${bar}\` ${pct}%`,
          `> Text XP: ${formatXP(profile.xp)} | Voice: ${formatDuration(actualVoiceSecs)} | Messages: ${profile.messages ?? 0}`,
        ].join('\n')
      )
    );

    const payload = {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };

    if (rankCardAttachment) {
      payload.files = [rankCardAttachment];
    }

    return ctx.reply(payload);
  },
});
