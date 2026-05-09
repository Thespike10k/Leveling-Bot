import {
  AttachmentBuilder
} from 'discord.js';

import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';

import { UserService } from '../database/services/UserService.js';
import { GuildSettingsRepository } from '../database/repositories/GuildSettingsRepository.js';
import { emoji } from '#utils/emoji';
import { config } from '#config';
import { formatXP } from '#utils';

const DEFAULT_MSG = '{mention} leveled up to **Level {level}**! 🎉';

function replacePlaceholders(template, user, level, xp) {
  return template
    .replace(/{mention}/g, `<@${user.id}>`)
    .replace(/{username}/g, user.username)
    .replace(/{level}/g, level)
    .replace(/{xp}/g, formatXP(xp));
}

export async function sendLevelUp(client, fallbackChannel, userTarget, guildId, newLevel, mult = 1) {
  const settings = GuildSettingsRepository.get(guildId) ?? {};
  if (settings.level_up_enabled === 0) return;

  const profile = UserService.getProfile(userTarget.id, guildId);
  if (!profile) return;

  const guild = client.guilds.cache.get(guildId);

  let member = null;
  if (guild) {
    member = await guild.members.fetch(userTarget.id).catch(() => null);
  }

  const xpInLevel = profile.xpForNext - profile.remainingXp;
  const progress = Math.min(1, xpInLevel / profile.xpForNext);

  const avatarURL =
    member?.displayAvatarURL({ size: 256, extension: 'png' }) ??
    userTarget.displayAvatarURL({ size: 256, extension: 'png' });

  
  const canvas = createCanvas(661, 254);
  const ctx = canvas.getContext('2d');

  
  try {
    let bg;
    if (settings.level_up_background) {
      bg = await loadImage(settings.level_up_background).catch(() => null);
    }

    if (!bg) {
      const bgPath = path.resolve(process.cwd(), 'assets', 'levelbg.png');
      bg = await loadImage(bgPath);
    }

    ctx.drawImage(bg, 0, 0, 661, 254);
  } catch (e) {
    console.error('[LevelUpSender] Background Image Load Failure:', e);
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 661, 254);
  }

  
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, 661, 254);

  
  const avatar = await loadImage(avatarURL);

  const avatarSize = 110;
  const avatarX = 500;
  const avatarY = 70;

  ctx.save();
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2,
    0,
    Math.PI * 2
  );
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 3,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  
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
  ctx.roundRect(
    barX,
    barY + barH * (1 - progress),
    barW,
    barH * progress,
    10
  );
  ctx.fill();

  
  ctx.fillStyle = '#ffffff';

  
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('LEVEL UP', 70, 60);

  
  ctx.font = 'bold 22px sans-serif';

  let username = userTarget.username;
  const maxWidth = 320;

  if (ctx.measureText(username).width > maxWidth) {
    while (ctx.measureText(username + '...').width > maxWidth) {
      username = username.slice(0, -1);
    }
    username += '...';
  }

  ctx.fillText(username, 70, 95);

  
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(`LVL ${newLevel}`, 70, 150);

  
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#dddddd';
  ctx.fillText(
    `${formatXP(xpInLevel)} / ${formatXP(profile.xpForNext)} XP`,
    70,
    185
  );

  const buffer = canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buffer, { name: 'levelup.png' });

  const rawMsg = settings.level_up_message ?? DEFAULT_MSG;
  const content = replacePlaceholders(rawMsg, userTarget, newLevel, profile.xp);

  const payload = {
    content,
    files: [attachment]
  };

  
  try {
    if (settings.level_up_dm) {
      await userTarget.send(payload).catch(() => {});
    }

    const targetChannel =
      guild?.channels.cache.get(settings.level_up_channel) ?? fallbackChannel;

    if (targetChannel) {
      await targetChannel.send(payload).catch(() => {});
    }
  } catch (err) {
    console.error('[LevelUpSender Delivery]', err);
  }
}

// AeroX Leveling System  Made By Joshhhhh
