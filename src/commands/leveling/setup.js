// AeroX Leveling System — Made By Joshhhhh
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';
import { Command } from '#structures/classes/Command';
import { GuildService } from '../../database/services/GuildService.js';
import { LevelRewardsRepository } from '../../database/repositories/LevelRewardsRepository.js';
import {
  getSystemThumbnail,
  PANEL_ACCENTS,
} from './_panel.js';
import { rejectForeignInteraction } from './_interactions.js';
import { emoji } from '#utils/emoji';

const COMMAND_NAME = 'setup';
const DEFAULT_MSG = '{mention} leveled up to **Level {level}**! 🎉';

const PLACEHOLDERS = [
  '{mention} — pings the user',
  '{username} — inserts the username',
  '{level} — inserts the new level',
  '{xp} — inserts the total XP',
].join('\n');

const DISCORD_CDN_REGEX = /https?:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\//i;
const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

function isValidImageUrl(url) {
  try {
    new URL(url);
    return IMAGE_EXTENSION_REGEX.test(url);
  } catch {
    return false;
  }
}

function isDiscordCdnUrl(url) {
  return DISCORD_CDN_REGEX.test(url);
}

// ── Canvas preview generator ──────────────────────────────────────────────────
async function generatePreviewCard(author, backgroundUrl) {
  const canvas = createCanvas(661, 254);
  const ctx = canvas.getContext('2d');

  // Background
  try {
    let bg = null;
    if (backgroundUrl) {
      bg = await loadImage(backgroundUrl).catch(() => null);
    }
    if (!bg) {
      const bgPath = path.resolve(process.cwd(), 'assets', 'levelbg.png');
      bg = await loadImage(bgPath).catch(() => null);
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
  const avatarURL = author.displayAvatarURL({ size: 256, extension: 'png' });
  const avatar = await loadImage(avatarURL).catch(() => null);

  const avatarSize = 110;
  const avatarX = 500;
  const avatarY = 70;

  if (avatar) {
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
  }

  // Progress bar (50% preview)
  const progress = 0.5;
  const barX = 40, barY = 40, barW = 12, barH = 170;

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
  ctx.fillText('LEVEL UP', 70, 60);

  ctx.font = 'bold 22px sans-serif';
  let username = author.username ?? 'Preview';
  const maxWidth = 320;
  if (ctx.measureText(username).width > maxWidth) {
    while (ctx.measureText(username + '...').width > maxWidth) username = username.slice(0, -1);
    username += '...';
  }
  ctx.fillText(username, 70, 95);

  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('LVL 10', 70, 150);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#dddddd';
  ctx.fillText('500 / 1,000 XP', 70, 185);

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'preview.png' });
}

// Builds the full message payload — attaches a live canvas preview on image/preview steps
async function buildPayload(ctx, step, state, status = 'idle') {
  const isPreviewStep = (step === 'image' || step === 'preview') && status === 'idle';

  if (isPreviewStep) {
    try {
      const attachment = await generatePreviewCard(ctx.author, state.level_up_background);
      return {
        components: [buildWizardPanel(ctx, step, state, status, 'attachment://preview.png')],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
      };
    } catch (e) {
      console.error('[Setup Preview]', e);
    }
  }

  return {
    components: [buildWizardPanel(ctx, step, state, status)],
    flags: MessageFlags.IsComponentsV2,
  };
}

function formatDestination(state) {
  const parts = [];
  if (state.level_up_dm) parts.push('Direct Messages');
  if (state.level_up_channel) parts.push(`<#${state.level_up_channel}>`);
  else if (!state.level_up_dm) parts.push('Current channel');

  return parts.length > 0 ? parts.join(' & ') : 'Current channel';
}

/**
 * Adds a header section to the container.
 * SectionBuilder REQUIRES an accessory (Thumbnail or Button) — if there's no
 * thumbUrl we fall back to a plain TextDisplayBuilder so validation never blows up.
 */
function addHeader(container, thumbUrl, content) {
  if (thumbUrl) {
    container.addSectionComponents(
      new SectionBuilder()
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  }
}

function buildWizardPanel(ctx, step, state, status = 'idle', previewUrl = null) {
  const container = new ContainerBuilder().setAccentColor(0xffffff);
  const thumbUrl = getSystemThumbnail(ctx);

  // ── Terminal states — no SectionBuilder needed, just plain text ──────────
  if (status === 'closed' || status === 'expired') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Leveling UP Setup\n> **Panel ${status}.**`)
    );
    return container;
  }

  if (status === 'saved') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# Leveling UP Setup\n> **Configuration applied successfully!** ${emoji.aerox.check}`
      )
    );
    return container;
  }

  // ── Active wizard steps ───────────────────────────────────────────────────
  const rows = [];

  if (step === 'welcome') {
    addHeader(
      container,
      thumbUrl,
      `# Leveling UP Setup Wizard\n> **Welcome! Let's get things configured.**\nUse this interactive wizard to set up where and how level-up notifications appear.`
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wiz_start').setLabel('Start Setup').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('wiz_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
      )
    );
  } else if (step === 'channel') {
    addHeader(
      container,
      thumbUrl,
      `# Step 1: Channel Setup\n> **Choose where the bot should send level up alerts.**`
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Currently selected: **${formatDestination(state)}**`)
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('wiz_channel_select')
          .setPlaceholder('Select a new text channel...')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1)
          .setMaxValues(1)
      )
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('wiz_ch_dm')
          .setLabel(state.level_up_dm ? 'Disable DMs' : 'Enable DMs')
          .setStyle(state.level_up_dm ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('wiz_ch_current')
          .setLabel('Reset to current channel')
          .setStyle(ButtonStyle.Secondary),
      )
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wiz_next_msg').setLabel('Next Step').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('wiz_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
      )
    );
  } else if (step === 'message') {
    addHeader(
      container,
      thumbUrl,
      `# Step 2: Custom Message\n> **What's the message the bot should send on a level up?**`
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    const msgDisplay = state.level_up_message.length > 100
      ? `${state.level_up_message.slice(0, 100)}…`
      : state.level_up_message;
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Pending Custom Message:\n\`${msgDisplay}\``)
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wiz_msg_edit').setLabel('Edit Text').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('wiz_msg_default').setLabel('Use System Default').setStyle(ButtonStyle.Secondary),
      )
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wiz_prev_ch').setLabel('Back').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('wiz_next_img').setLabel('Next Step').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('wiz_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
      )
    );
  } else if (step === 'image') {
    addHeader(
      container,
      thumbUrl,
      `# Step 3: Background Image\n> **Customize the look of your level-up cards.**`
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    if (previewUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(previewUrl)
        )
      );
      if (state.level_up_background && isDiscordCdnUrl(state.level_up_background)) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `⚠️ **This is a Discord CDN link — it will expire in a few days.** For a permanent background use [Imgur](https://imgur.com) or [Catbox](https://catbox.moe).`
          )
        );
      }
    } else if (state.level_up_background) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(state.level_up_background)
        )
      );
      if (isDiscordCdnUrl(state.level_up_background)) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `⚠️ **This is a Discord CDN link — it will expire in a few days.** For a permanent background use [Imgur](https://imgur.com) or [Catbox](https://catbox.moe).`
          )
        );
      }
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`Currently using: **System Default**\nUpload an image below to customize it! (661x254 recommended)`)
      );
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Set a background via a direct image URL, or upload a file from your device.')
    );

    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wiz_img_url').setLabel('Set Image URL').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('wiz_img_upload').setLabel('Upload File').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('wiz_img_default').setLabel('Reset to Default').setStyle(ButtonStyle.Secondary),
      )
    );

    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wiz_prev_msg').setLabel('Back').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('wiz_next_preview').setLabel('Review Configuration').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('wiz_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
      )
    );
  } else if (step === 'preview') {
    addHeader(
      container,
      thumbUrl,
      `# Step 4: Final Review\n> **Review your settings before applying everything.**`
    );

    if (previewUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(previewUrl)
        )
      );
    } else if (state.level_up_background) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(state.level_up_background)
        )
      );
    }
    const msgDisplay = state.level_up_message.length > 50
      ? `${state.level_up_message.slice(0, 50)}…`
      : state.level_up_message;
    const rewards = LevelRewardsRepository.count(ctx.guildId);
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `- **Announcements** — ${state.level_up_enabled ? 'Enabled' : 'Disabled'}`,
          `- **Destination** — ${formatDestination(state)}`,
          `- **Message** — \`${msgDisplay}\``,
          `- **Background** — ${state.level_up_background ? 'Custom' : 'Default'}`,
          `- **Rewards** — ${rewards} role${rewards !== 1 ? 's' : ''} configured`,
        ].join('\n')
      )
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('wiz_toggle_enable')
          .setLabel(state.level_up_enabled ? 'Disable System' : 'Enable System')
          .setStyle(state.level_up_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('wiz_edit_ch').setLabel('Edit Settings').setStyle(ButtonStyle.Secondary),
      )
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wiz_reward_add').setLabel('Add Reward').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('wiz_reward_remove').setLabel('Remove Reward').setStyle(ButtonStyle.Danger),
      )
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wiz_confirm').setLabel('Confirm & Apply').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('wiz_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
      )
    );
  }

  for (const row of rows) {
    container.addActionRowComponents(row);
  }

  return container;
}

export const command = new Command({
  name: COMMAND_NAME,
  aliases: [],
  description: 'Step-by-step setup wizard for the leveling system',
  usage: '',
  category: 'Admin',
  cooldown: 5,

  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Step-by-step setup wizard for the leveling system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(ctx) {
    const hasAny =
      ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
      ctx.member?.permissions?.has(PermissionFlagsBits.ManageRoles);

    if (!hasAny) {
      return ctx.reply({
        content: `${emoji.aerox.cross} You need **Manage Server** or **Manage Roles** to use this command.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (ctx.isSlash && !ctx.interaction.deferred && !ctx.interaction.replied) {
      await ctx.interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    // Load initial state from the database
    const dbSettings = GuildService.getSettings(ctx.guildId) ?? {};

    // In-memory wizard state
    let wizardState = {
      level_up_enabled: (dbSettings.level_up_enabled ?? 1) === 1,
      level_up_channel: dbSettings.level_up_channel ?? null,
      level_up_dm: dbSettings.level_up_dm ? true : false,
      level_up_message: dbSettings.level_up_message ?? DEFAULT_MSG,
      level_up_background: dbSettings.level_up_background ?? null,
    };

    let currentStep = 'welcome';
    const sent = await ctx.channel.send({
      components: [buildWizardPanel(ctx, currentStep, wizardState)],
      flags: MessageFlags.IsComponentsV2,
    });

    if (ctx.isSlash) {
      ctx.interaction.deleteReply().catch(() => { });
    } else {
      ctx.message.delete().catch(() => { });
    }

    const collector = sent.createMessageComponentCollector({
      time: 15 * 60 * 1000,
    });

    collector.on('collect', async (i) => {
      if (await rejectForeignInteraction(i, ctx.author.id)) return;

      const isAdmin = i.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
      const isStaff = i.member?.permissions?.has(PermissionFlagsBits.ManageRoles);

      if (
        !isAdmin &&
        ['wiz_ch_dm', 'wiz_ch_current', 'wiz_channel_select', 'wiz_msg_edit', 'wiz_toggle_enable', 'wiz_confirm'].includes(i.customId)
      ) {
        return i.reply({
          content: `${emoji.aerox.cross} You need **Manage Server** to edit core configurations.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ── Cancels & Step Navigation ─────────────────────────────────────────
      if (i.customId === 'wiz_cancel') {
        try {
          await i.update({
            components: [buildWizardPanel(ctx, 'welcome', null, 'closed')],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (e) { }
        collector.stop('closed');
        return;
      } else if (i.customId === 'wiz_start') {
        currentStep = 'channel';
      } else if (i.customId === 'wiz_next_msg' || i.customId === 'wiz_edit_msg') {
        currentStep = 'message';
      } else if (i.customId === 'wiz_next_img') {
        currentStep = 'image';
      } else if (i.customId === 'wiz_prev_msg') {
        currentStep = 'message';
      } else if (i.customId === 'wiz_prev_ch' || i.customId === 'wiz_edit_ch') {
        currentStep = 'channel';
      } else if (i.customId === 'wiz_next_preview') {
        currentStep = 'preview';
      }

      // ── Channel Updates ───────────────────────────────────────────────────
      else if (i.customId === 'wiz_channel_select') {
        wizardState.level_up_channel = i.values[0];
      } else if (i.customId === 'wiz_ch_dm') {
        wizardState.level_up_dm = !wizardState.level_up_dm;
      } else if (i.customId === 'wiz_ch_current') {
        wizardState.level_up_channel = null;
      }

      // ── Image Updates ─────────────────────────────────────────────────────
      else if (i.customId === 'wiz_img_url') {
        const urlModal = new ModalBuilder()
          .setCustomId('setup_img_modal')
          .setTitle('Background Image URL');

        urlModal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('img_url_input')
              .setLabel('Direct image URL (png, jpg, gif, webp)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('https://example.com/image.png')
              .setRequired(true)
              .setMaxLength(500)
          )
        );

        await i.showModal(urlModal);

        const ms = await i
          .awaitModalSubmit({
            filter: (mi) => mi.customId === 'setup_img_modal' && mi.user.id === i.user.id,
            time: 5 * 60 * 1000,
          })
          .catch(() => null);

        if (ms) {
          const url = ms.fields.getTextInputValue('img_url_input').trim();

          if (isDiscordCdnUrl(url)) {
            wizardState.level_up_background = url;
            if (!ms.deferred && !ms.replied) {
              await ms.reply({
                content: `⚠️ Image saved, but Discord CDN links **expire after a few days**. For a permanent background use [Imgur](https://imgur.com) or [Catbox](https://catbox.moe).`,
                flags: MessageFlags.Ephemeral,
              }).catch(() => { });
            }
            return sent.edit(await buildPayload(ctx, currentStep, wizardState)).catch(() => { });
          }

          if (!isValidImageUrl(url)) {
            if (!ms.deferred && !ms.replied) {
              await ms.reply({
                content: `⚠️ That doesn't look like a valid image URL. Make sure it ends in \`.png\`, \`.jpg\`, \`.gif\`, or \`.webp\`.`,
                flags: MessageFlags.Ephemeral,
              }).catch(() => { });
            }
            return;
          }

          wizardState.level_up_background = url;
          if (!ms.deferred && !ms.replied) await ms.deferUpdate().catch(() => { });
          return sent.edit(await buildPayload(ctx, currentStep, wizardState)).catch(() => { });
        }
        return;
      }

      else if (i.customId === 'wiz_img_upload') {
        await i.reply({
          content: `📎 **Send your image as a message in this channel** and I'll grab it automatically.\n> 661×254px recommended. You have 60 seconds.`,
          flags: MessageFlags.Ephemeral,
        });

        const collected = await i.channel.awaitMessages({
          filter: (m) => m.author.id === i.user.id && m.attachments.size > 0,
          max: 1,
          time: 60_000,
        }).catch(() => null);

        await i.deleteReply().catch(() => { });

        if (collected?.size > 0) {
          const attachment = collected.first().attachments.first();
          wizardState.level_up_background = attachment.url;
          collected.first().delete().catch(() => { });
        }

        return sent.edit(await buildPayload(ctx, currentStep, wizardState)).catch(() => { });
      }

      else if (i.customId === 'wiz_img_default') {
        wizardState.level_up_background = null;
      }

      // ── Message Updates ───────────────────────────────────────────────────
      else if (i.customId === 'wiz_msg_edit') {
        const modal = new ModalBuilder()
          .setCustomId('setup_msg_modal')
          .setTitle('Level-Up Message');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('msg_input')
              .setLabel('Enter custom message')
              .setStyle(TextInputStyle.Paragraph)
              .setValue(wizardState.level_up_message)
              .setMaxLength(500)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('msg_tokens')
              .setLabel('Variables (read-only reference)')
              .setStyle(TextInputStyle.Paragraph)
              .setValue(PLACEHOLDERS)
              .setRequired(false)
          )
        );

        await i.showModal(modal);

        const ms = await i
          .awaitModalSubmit({
            filter: (mi) => mi.customId === 'setup_msg_modal' && mi.user.id === i.user.id,
            time: 5 * 60 * 1000,
          })
          .catch(() => null);

        if (ms) {
          const raw = ms.fields.getTextInputValue('msg_input').trim();
          wizardState.level_up_message = raw.toLowerCase() === 'reset' ? DEFAULT_MSG : raw;
          await ms.deferUpdate();
          return sent.edit(await buildPayload(ctx, currentStep, wizardState)).catch(() => { });
        }
        return; // Timed out or failed
      } else if (i.customId === 'wiz_msg_default') {
        wizardState.level_up_message = DEFAULT_MSG;
      }

      // ── Preview Actions ───────────────────────────────────────────────────
      else if (i.customId === 'wiz_toggle_enable') {
        wizardState.level_up_enabled = !wizardState.level_up_enabled;
      }

      else if (i.customId === 'wiz_confirm') {
        GuildService.setLevelUpEnabled(ctx.guildId, wizardState.level_up_enabled);
        GuildService.setLevelUpChannel(ctx.guildId, wizardState.level_up_channel);
        GuildService.setLevelUpDM(ctx.guildId, wizardState.level_up_dm);
        GuildService.setLevelUpMessage(ctx.guildId, wizardState.level_up_message);
        GuildService.setLevelUpBackground(ctx.guildId, wizardState.level_up_background);

        try {
          await i.update({
            components: [buildWizardPanel(ctx, currentStep, null, 'saved')],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (e) {
          console.error('Wiz Confirm Error:', e);
        }
        collector.stop('saved');
        return;
      }

      // ── Rewards Handling (Inside Preview Panel) ───────────────────────────
      else if (i.customId === 'wiz_reward_add') {
        if (!isStaff) return i.reply({ content: `${emoji.aerox.cross} You need **Manage Roles**.`, flags: MessageFlags.Ephemeral });

        const rc = new ContainerBuilder().setAccentColor(0xffffff);
        rc.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Add Reward\n> Select a role first.`));
        rc.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId('wiz_role_add_sel')
              .setPlaceholder('Select a role...')
              .setMinValues(1)
              .setMaxValues(1)
          )
        );
        await i.reply({ components: [rc], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

        const roleCol = i.channel.createMessageComponentCollector({
          filter: (ri) => ri.customId === 'wiz_role_add_sel' && ri.user.id === i.user.id,
          max: 1,
          time: 2 * 60 * 1000,
        });

        roleCol.on('collect', async (ri) => {
          const role = i.guild.roles.cache.get(ri.values[0]);
          if (!role || !role.editable) {
            return ri.reply({ content: `${emoji.aerox.cross} Role not manageable by bot.`, flags: MessageFlags.Ephemeral });
          }

          const rModal = new ModalBuilder().setCustomId('r_modal').setTitle(`Reward: ${role.name}`);
          rModal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('l_input')
                .setLabel('Level (1-1000)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
          await ri.showModal(rModal);

          const rm = await ri
            .awaitModalSubmit({ filter: (mi) => mi.customId === 'r_modal' && mi.user.id === ri.user.id, time: 60_000 })
            .catch(() => null);
          if (!rm) return;

          const lvl = parseInt(rm.fields.getTextInputValue('l_input'), 10);
          if (!lvl || lvl < 1 || lvl > 1000) return rm.reply({ content: 'Invalid level.', flags: MessageFlags.Ephemeral });

          GuildService.addReward(ctx.guildId, lvl, role.id);
          await rm.deferUpdate();
          await i.deleteReply().catch(() => { });
          await sent.edit(await buildPayload(ctx, currentStep, wizardState)).catch(() => { });
        });
        return;
      }

      else if (i.customId === 'wiz_reward_remove') {
        if (!isStaff) return i.reply({ content: `${emoji.aerox.cross} You need **Manage Roles**.`, flags: MessageFlags.Ephemeral });

        const allRewards = GuildService.listRewards(ctx.guildId);
        if (!allRewards.length) return i.reply({ content: `${emoji.aerox.cross} No rewards configured.`, flags: MessageFlags.Ephemeral });

        const opts = allRewards.slice(0, 25).map((r) => ({
          label: `Level ${r.level} — ${i.guild.roles.cache.get(r.role_id)?.name ?? 'Unknown'}`,
          value: `${r.level}:${r.role_id}`,
        }));

        const rc = new ContainerBuilder().setAccentColor(0xffffff);
        rc.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Remove Reward\n> Select to remove.`));
        rc.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('wiz_role_rm_sel')
              .setPlaceholder('Select to remove')
              .addOptions(opts)
              .setMaxValues(1)
          )
        );

        await i.reply({ components: [rc], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

        const rmCol = i.channel.createMessageComponentCollector({
          filter: (ri) => ri.customId === 'wiz_role_rm_sel' && ri.user.id === i.user.id,
          max: 1,
          time: 2 * 60 * 1000,
        });

        rmCol.on('collect', async (ri) => {
          await ri.deferUpdate();
          const [lstr, rId] = ri.values[0].split(':');
          LevelRewardsRepository.remove(ctx.guildId, parseInt(lstr, 10), rId);
          await i.deleteReply().catch(() => { });
          await sent.edit(await buildPayload(ctx, currentStep, wizardState)).catch(() => { });
        });
        return;
      }

      // ── Default: update the panel ─────────────────────────────────────────
      try {
        const payload = await buildPayload(ctx, currentStep, wizardState);
        if (!i.replied && !i.deferred) {
          await i.update(payload);
        } else {
          await sent.edit(payload);
        }
      } catch (err) {
        console.error('Setup Wizard Edit Error:', err);
        const errPayload = {
          content: `${emoji.aerox.cross} Setup panel error: \`${err.message}\``,
          flags: MessageFlags.Ephemeral,
        };
        if (i.replied || i.deferred) {
          await i.followUp(errPayload).catch(() => { });
        } else {
          await i.reply(errPayload).catch(() => { });
        }
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'closed' || reason === 'saved') return;
      const status = reason === 'expired' ? 'expired' : 'closed';
      sent
        .edit({
          components: [buildWizardPanel(ctx, currentStep, null, status)],
          flags: MessageFlags.IsComponentsV2,
        })
        .catch(() => { });
    });
  },
});