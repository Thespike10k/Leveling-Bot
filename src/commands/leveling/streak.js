import {
  SlashCommandBuilder,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} from 'discord.js';
import { Command } from '#structures/classes/Command';
import { UserService } from '../../database/services/UserService.js';
import { emoji } from '#utils/emoji';

function buildStreakContainer(target, profile, isSelf = false) {
  const streak = profile?.streak ?? {};
  const current = streak.current ?? 0;
  const best = streak.best ?? 0;
  const lastAt = streak.last_claim_at ?? 0;
  const bonusPct = (current * 10).toFixed(0);
  
  const now = Math.floor(Date.now() / 1000);
  const nextAt = lastAt + 12 * 3600;
  const canClaim = now >= nextAt;
  const isExpired = lastAt > 0 && (now - lastAt > 36 * 3600);

  const avatarURL = target.displayAvatarURL({ size: 128, extension: 'png' });

  const container = new ContainerBuilder()
    .setAccentColor(0xffffff)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `## <a:firenation:1488896890614448342> ${target.username}'s Streak`,
              `- **User :** <@${target.id}>`,
              `- **Current Streak :** ${isExpired ? '0' : current} day(s) ${isExpired ? '`EXPIRED` ⚠️' : ''}`,
              `- **Best Streak :** ${best} day(s)`,
              `- **Last Claim :** ${lastAt > 0 ? `<t:${lastAt}:R>` : '`Never`'}`,
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
          ` **Streak Bonus:** \`+${isExpired ? '0' : bonusPct}%\` XP per message`,
          isExpired 
            ? `> ${emoji.aerox.warning} Your streak expired! Claim now to start again.`
            : (canClaim 
                ? `> ${emoji.aerox.bolt} Your streak claim is **AVAILABLE**!` 
                : `> ${emoji.aerox.clock} Next claim available <t:${nextAt}:R>`),
        ].join('\n')
      )
    );

  if (isSelf) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('streak_claim')
          .setLabel(canClaim ? 'Claim Streak' : 'On Cooldown')
          .setEmoji(emoji.aerox.streak)
          .setStyle(canClaim ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(!canClaim)
      )
    );
  }

  return container;
}

export const command = new Command({
  name: 'streak',
  aliases: ['mystreak'],
  description: 'View your daily message streak info',
  category: 'Leveling',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('View or claim your daily streak info')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View a user\'s streak info')
        .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('claim')
        .setDescription('Claim your 12-hour streak reward')
    ),

  async execute(ctx) {
    const sub = ctx.isSlash ? ctx.interaction.options.getSubcommand(false) : ctx.args[0]?.toLowerCase();

    if (sub === 'claim' || (ctx.isButton && ctx.interaction.customId === 'streak_claim')) {
      const result = UserService.claimStreak(ctx.author.id, ctx.guildId);

      if (!result.success) {
        const errContainer = new ContainerBuilder()
          .setAccentColor(0xef4444)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.aerox.cross} Oops! You are on cooldown.\n> You can claim again <t:${result.nextAt}:R>.`)
          );
        return ctx.reply({
          components: [errContainer],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const successContainer = new ContainerBuilder()
        .setAccentColor(0x22c55e)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `## ${emoji.aerox.streak} Streak Claimed!`,
              `> You gained **${result.xpGained} XP** and your streak is now **${result.current}**!`,
              `Keep it up to maintain your \`+${(result.current * 10)}%\` bonus.`,
            ].join('\n')
          )
        );

      if (ctx.isButton) {
        return ctx.interaction.update({
          components: [successContainer],
        });
      }

      return ctx.reply({
        components: [successContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Default: View logic
    const target = (ctx.isSlash ? (ctx.interaction.options.getUser('user') ?? ctx.author) : (ctx.message.mentions.users.first() ?? ctx.author));

    if (target.bot) {
      const container = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${emoji.aerox.cross} Bots don't have streaks!`)
        );
      return ctx.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    UserService.ensure(target.id, ctx.guildId);
    const profile = UserService.getProfile(target.id, ctx.guildId);

    if (!profile) {
      const container = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## <:warning2:1488897327514124359> No data found for **${target.username}**.`)
        );
      return ctx.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const isSelf = target.id === ctx.author.id;
    return ctx.reply({
      components: [buildStreakContainer(target, profile, isSelf)],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});