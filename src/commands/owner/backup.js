import {
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  FileBuilder,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  ThumbnailBuilder
} from 'discord.js';

import { Command } from '#structures/classes/Command';
import { emoji } from '#utils/emoji';
import { logger } from '#utils/logger';

function isValidUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return /^https?:$/i.test(parsed.protocol);
  } catch {
    return false;
  }
}
import { readdir, readFile } from 'fs/promises';
import { join, resolve, relative } from 'path';

const log = logger.tag('OwnerCmd');
const OWNER_ID = '1243923134499786794';

async function collectFiles(dir, base) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name.endsWith('.db') ||
      ['.db-shm', '.db-wal'].some(x => entry.name.endsWith(x))
    ) continue;

    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...await collectFiles(full, base));
    } else {
      results.push({ full, rel: relative(base, full) });
    }
  }

  return results;
}

export const command = new Command({
  name: 'backup',
  aliases: ['src', 'source', 'code', 'botzip'],
  description: 'Owner only — DMs full bot source',
  category: 'Owner',
  cooldown: 60,
  ownerOnly: true,

  async execute(ctx) {

    if (ctx.userId !== OWNER_ID) {
      const ui = new ContainerBuilder().setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# Access Denied\n-# Owner only command`
          )
        );

      return ctx.reply({
        components: [ui],
        flags: MessageFlags.IsComponentsV2
      });
    }

    try {
      const root = resolve('./');
      const files = await collectFiles(root, root);

      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      zip.file('SETUP.md', `AeroX Setup\n\nRun: npm install → npm start`);

      for (const file of files) {
        try {
          const data = await readFile(file.full);
          zip.file(`aerox-bot/${file.rel}`, data);
        } catch { }
      }

      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      });

      const attachment = new AttachmentBuilder(buffer, {
        name: 'AeroX-Bot.zip'
      });

      const container = new ContainerBuilder().setAccentColor(0xffffff);

      // 🔹 SMALL THUMBNAIL using SectionBuilder + ThumbnailBuilder (accessory)
      if (process.env.THUMBNAIL_URL) {
        container.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# AeroX Source\n-# Full bot package`
              )
            )
            .setThumbnailAccessory(
              new ThumbnailBuilder().setURL(process.env.THUMBNAIL_URL)
            )
        );
      } else {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# AeroX Source\n-# Full bot package`
          )
        );
      }

      container
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `- **Package:** Full Source Code\n- **Includes:** Commands, Events, Utilities\n\n-# Check SETUP.md inside the zip`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small)
        )
        .addFileComponents(
          new FileBuilder()
            .setURL('attachment://AeroX-Bot.zip')
        );

      // 🔻 BANNER
      if (isValidUrl(process.env.BANNER_URL)) {
        container
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Large)
          )
          .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
              new MediaGalleryItemBuilder()
                .setURL(process.env.BANNER_URL)
            )
          );
      }

      await ctx.author.send({
        components: [container],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2
      });

      return ctx.reply({ content: `-# Sent to your respected DMs ${emoji.aerox.check}` });

    } catch (err) {
      log.error(err);

      const fail = new ContainerBuilder().setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# Error\n-# ${err.message}`
          )
        );

      return ctx.reply({
        components: [fail],
        flags: MessageFlags.IsComponentsV2
      });
    }
  }
});