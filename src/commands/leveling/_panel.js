import {
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { emoji } from '#utils/emoji';

export const PANEL_ACCENTS = {
  info: 0xffffff,
  success: 0xffffff,
  warning: 0xffffff,
  error: 0xffffff,
  purple: 0xffffff,
  gold: 0xffffff,
  cyan: 0xffffff,
};

function formatSection(section) {
  if (typeof section === 'string') return section;

  return [
    section.title ? `## ${section.icon ? `${section.icon} ` : ''}${section.title}` : null,
    ...(section.lines ?? []),
  ].filter(Boolean).join('\n');
}

export function getSystemFooter(ctx, label = 'Advanced Levelup System') {
  const systemName = ctx.client.user?.username ?? 'AeroX';
  return `${systemName} | ${label}`;
}

export function getSystemThumbnail(ctx, preferGuild = true) {
  if (preferGuild) {
    const guildIcon = ctx.guild?.iconURL?.({ size: 128, extension: 'png' });
    if (guildIcon) return guildIcon;
  }

  return (
    ctx.client.user?.displayAvatarURL?.({ size: 128, extension: 'png' })
    ?? ctx.author?.displayAvatarURL?.({ size: 128, extension: 'png' })
    ?? null
  );
}

export function getUserThumbnail(user) {
  return user?.displayAvatarURL?.({ size: 128, extension: 'png' }) ?? null;
}

export function prefixCommand(ctx, body) {
  const prefix = ctx.client.getPrefix?.(ctx.guildId) ?? '!';
  return `${prefix}${body}`.trim();
}

export function buildUsageSection(ctx, { commandName, usage = '', examples = [], note }) {
  const baseCommand = `${commandName}${usage ? ` ${usage}` : ''}`;

  return {
    title: 'Command Usage',
    icon: emoji.aerox.settings,
    lines: [
      `- Prefix: \`${prefixCommand(ctx, baseCommand)}\``,
      `- Slash: \`/${commandName}\``,
      ...examples.map(example => `- Example: \`${prefixCommand(ctx, example)}\``),
      ...(note ? [`> ${note}`] : []),
    ],
  };
}

export function buildLevelPanel({
  title,
  subtitle,
  accentColor = PANEL_ACCENTS.info,
  thumbnailUrl,
  sections = [],
}) {
  const container = new ContainerBuilder().setAccentColor(0xffffff);

  const hasAccessory = sections.some(s => s?.accessory);

  // If we have an accessory-section, the header MUST be a TextDisplay (max 1 Section)
  // If we have no accessories, the header can be a Section to support a thumbnail
  if (thumbnailUrl && !hasAccessory) {
    const header = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        subtitle ? `# ${title}\n-# ${subtitle}` : `# ${title}`
      )
    );
    header.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
    container.addSectionComponents(header);
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        subtitle ? `# ${title}\n-# ${subtitle}` : `# ${title}`
      )
    );
  }

  for (const section of sections.filter(Boolean)) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    const content = formatSection(section);
    // Use the one allowed Section slot for any section that needs an accessory
    if (section.accessory) {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
          .setButtonAccessory(section.accessory)
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(content)
      );
    }
  }

  // --- Hardcoded Mandatory Branding ---
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );
  // ------------------------------------

  return container;
}

export function buildPermissionPanel(ctx, {
  commandName,
  usage = '',
  permissionLabel,
  examples = [],
  title = 'Permission Required',
}) {
  return buildLevelPanel({
    title,
    subtitle: ctx.guild?.name ?? 'Server Controls',
    thumbnailUrl: getSystemThumbnail(ctx),
    sections: [
      {
        title: 'Access Check',
        icon: emoji.aerox.settings,
        lines: [
          `- Missing Permission: \`${permissionLabel}\``,
          `- You need **${permissionLabel}** to use this command.`,
        ],
      },
      buildUsageSection(ctx, { commandName, usage, examples }),
    ],
  });
}

export function buildUsagePanel(ctx, {
  title,
  problem,
  commandName,
  usage = '',
  examples = [],
  note,
}) {
  return buildLevelPanel({
    title,
    subtitle: ctx.guild?.name ?? 'Server Controls',
    thumbnailUrl: getSystemThumbnail(ctx),
    sections: [
      {
        title: 'Input Check',
        icon: emoji.aerox.warning,
        lines: [problem],
      },
      buildUsageSection(ctx, { commandName, usage, examples, note }),
    ],
  });
}

export function panelReply(container, extra = {}) {
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
    ...extra,
  };
}
