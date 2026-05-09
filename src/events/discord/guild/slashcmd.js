import { CommandContext } from '#structures/classes/CommandContext';
import { emoji } from '#utils/emoji';
import { logger } from '#utils/logger';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';

import { inspect } from 'util';

const log = logger.tag('SlashCmd');

export const event = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) {
        try { await cmd.autocomplete(interaction); } catch (err) { log.error(err); }
      }
      return;
    }

    if (interaction.isMessageComponent()) {
      const customId = interaction.customId;
      if (customId.startsWith('persistent:')) {
        const [, cmdName, ...args] = customId.split(':');
        const cmd = client.commands.get(cmdName);
        if (cmd) {
          const ctx = new CommandContext({ interaction, args, client });
          try {
            return await cmd.execute(ctx);
          } catch (err) {
            log.error(`Error in persistent component ${customId}:`, err);
            return;
          }
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    const now = Date.now();
    if (!client.cooldowns.has(cmd.name)) client.cooldowns.set(cmd.name, new Map());
    const timestamps = client.cooldowns.get(cmd.name);
    const cdMs = (cmd.cooldown ?? 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expires = timestamps.get(interaction.user.id) + cdMs;
      if (now < expires) {
        const secs = ((expires - now) / 1000).toFixed(1);
        const container = new ContainerBuilder()
          .setAccentColor(0xffffff)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emoji.aerox.settings} **Cooldown** — wait **${secs}s** before using \`/${cmd.name}\` again.`
            )
          );
        return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cdMs);

    const ctx = new CommandContext({ interaction, args: [], client });
    try {
      await cmd.execute(ctx);
    } catch (err) {
      log.error(`Error in slash command ${cmd.name}:`);
      console.error(err);
      if (err.errors) console.error(inspect(err.errors, { depth: null }));
      
      const container = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`${emoji.aerox.cross} An error occurred: \`${err.message}\``)
        );
      const method = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
      interaction[method]({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
  },
};
