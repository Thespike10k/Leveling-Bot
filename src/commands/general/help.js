import { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';
import { Command } from '#structures/classes/Command';

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function isValidUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return /^https?:$/i.test(parsed.protocol);
  } catch {
    return false;
  }
}

function buildMainMenu(ctx, categories, prefix, isDisabled = false) {
  const bannerUrl = process.env.BANNER_URL;
  const user = ctx.author ?? ctx.interaction?.user;
  const userAvatar = user?.displayAvatarURL({ dynamic: true });

  const container = new ContainerBuilder().setAccentColor(0xffffff);

  // Banner
  if (isValidUrl(bannerUrl)) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl))
    );
  }

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# Help Menu`)
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // Section with prefix text and thumbnail
  const header = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `- **Prefix:** \`${prefix}\`\n` +
      `- **Set prefix with:** \`/setprefix\`\n` +
      `- **Join Support Server:** [AeroX Development](https://discord.gg/aerox)`
    )
  );

  if (userAvatar) {
    header.setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatar));
  }
  container.addSectionComponents(header);

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // Invite & Support Action Row
  const supportUrl = process.env.SUPPORT_URL || 'https://discord.gg/';
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${ctx.client.user.id}&permissions=8&scope=bot%20applications.commands`;

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Invite').setStyle(ButtonStyle.Link).setURL(inviteUrl),
      new ButtonBuilder().setLabel('Support').setStyle(ButtonStyle.Link).setURL(supportUrl)
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // Category Buttons with permission filtering
  const hasAdmin = ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild) || ctx.member?.permissions?.has(PermissionFlagsBits.Administrator) || ctx.author.id === process.env.OWNER_ID;
  const filteredCategories = categories.filter(cat => {
    const lower = cat.toLowerCase();
    if (lower === 'admin' || lower === 'owner' || lower === 'dev') {
      return hasAdmin;
    }
    return true;
  });

  const chunks = chunkArray(filteredCategories, 5);
  for (const row of chunks) {
    const actionRow = new ActionRowBuilder();
    for (const cat of row) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`help_cat_${cat}`)
          .setLabel(cat)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isDisabled)
      );
    }
    container.addActionRowComponents(actionRow);
  }
  return container;
}

function buildCategoryMenu(ctx, category, categoryCommands, isDisabled = false) {
  const bannerUrl = process.env.BANNER_URL;
  const user = ctx.author ?? ctx.interaction?.user;
  const userAvatar = user?.displayAvatarURL({ dynamic: true });

  const container = new ContainerBuilder().setAccentColor(0xffffff);

  // Banner
  if (isValidUrl(bannerUrl)) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl))
    );
  }

  const cmdList = categoryCommands.map(cmd => {
    return `- **/${cmd.name}**\n  > ${cmd.description}`;
  }).join('\n');

  const header = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${category} Commands\n${cmdList || '> No commands found.'}`
    )
  );

  if (userAvatar) {
    header.setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatar));
  }
  
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );
  
  container.addSectionComponents(header);
  
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('help_back')
        .setLabel('Back to Main Menu')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isDisabled)
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# **Made by JoshNvrDie - AeroX Development**`)
  );

  return container;
}

export const command = new Command({
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Show a list of all available commands',
  usage: '',
  category: 'General',
  cooldown: 3,
  slashData: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show a list of all available commands'),

  async execute(ctx) {
    const prefix = ctx.client.getPrefix(ctx.guildId);
    
    // Extract unique categories
    const commandsArray = Array.from(ctx.client.commands.values());
    const categoriesSet = new Set();
    commandsArray.forEach(cmd => {
      categoriesSet.add(cmd.category || 'General');
    });
    const categories = Array.from(categoriesSet);

    // Initial state
    let viewingCategory = null;

    // Main menu payload
    const mainMenuContainer = buildMainMenu(ctx, categories, prefix);

    let sentMsg;
    if (ctx.isSlash) {
      if (!ctx.interaction.deferred && !ctx.interaction.replied) {
        sentMsg = await ctx.interaction.reply({ components: [mainMenuContainer], flags: MessageFlags.IsComponentsV2, fetchReply: true });
      } else {
        sentMsg = await ctx.interaction.editReply({ components: [mainMenuContainer], flags: MessageFlags.IsComponentsV2 });
      }
    } else {
      sentMsg = await ctx.reply({ components: [mainMenuContainer], flags: MessageFlags.IsComponentsV2 });
    }

    const collector = sentMsg.createMessageComponentCollector({
      filter: i => i.user.id === ctx.author.id,
      time: 3 * 60 * 1000 // 3 minutes timeout
    });

    collector.on('collect', async (i) => {
      if (i.customId === 'help_back') {
        viewingCategory = null;
        const mm = buildMainMenu(ctx, categories, prefix, false);
        await i.update({ components: [mm], flags: MessageFlags.IsComponentsV2 });
        return;
      }

      if (i.customId.startsWith('help_cat_')) {
        viewingCategory = i.customId.replace('help_cat_', '');
        const categoryCommands = commandsArray.filter(cmd => (cmd.category || 'General') === viewingCategory);
        
        const catMenu = buildCategoryMenu(ctx, viewingCategory, categoryCommands, false);
        await i.update({ components: [catMenu], flags: MessageFlags.IsComponentsV2 });
      }
    });

    collector.on('end', () => {
      if (!sentMsg) return;
      
      const disabledContainer = viewingCategory 
        ? buildCategoryMenu(ctx, viewingCategory, commandsArray.filter(cmd => (cmd.category || 'General') === viewingCategory), true)
        : buildMainMenu(ctx, categories, prefix, true);

      if (ctx.isSlash) {
        ctx.interaction.editReply({ components: [disabledContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
      } else {
        sentMsg.edit({ components: [disabledContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
      }
    });
  }
});
