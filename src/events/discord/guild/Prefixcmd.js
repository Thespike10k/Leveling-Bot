import { GuildSettingsRepository } from '../../../database/repositories/GuildSettingsRepository.js';
import { CommandContext } from '#structures/classes/CommandContext';
import { emoji } from '#utils/emoji';
import { logger } from '#utils/logger';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';

import { inspect } from 'util';

const log = logger.tag('PrefixCmd');

export const event = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot || !message.guild) return;

    const guildSettings = GuildSettingsRepository.get(message.guild.id);
    const prefix = guildSettings?.prefix ?? '!';

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const resolved = client.commands.get(commandName)
      ?? client.commands.get(client.aliases.get(commandName));

    if (!resolved) return;

    const now = Date.now();
    if (!client.cooldowns.has(resolved.name)) client.cooldowns.set(resolved.name, new Map());
    const timestamps = client.cooldowns.get(resolved.name);
    const cdMs = (resolved.cooldown ?? 3) * 1000;

    if (timestamps.has(message.author.id)) {
      const expires = timestamps.get(message.author.id) + cdMs;
      if (now < expires) {
        const secs = ((expires - now) / 1000).toFixed(1);
        const container = new ContainerBuilder()
          .setAccentColor(0xffffff)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emoji.aerox.settings} **Cooldown** — wait **${secs}s** before using \`${resolved.name}\` again.`
            )
          );
        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cdMs);

    const ctx = new CommandContext({ message, args, client });
    try {
      await resolved.execute(ctx);
    } catch (err) {
      log.error(`Error in command ${resolved.name}:`);
      console.error(err);
      if (err.errors) console.error(inspect(err.errors, { depth: null }));

      const container = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`${emoji.aerox.cross} An error occurred: \`${err.message}\``)
        );
      message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
  },
};
