import { MessageFlags } from 'discord.js';
import { emoji } from '#utils/emoji';

const DEFAULT_OWNER_ONLY_MESSAGE = `- ${emoji.aerox.info} Only the user who ran this command can use these buttons.`;

export async function rejectForeignInteraction(interaction, ownerId, message = DEFAULT_OWNER_ONLY_MESSAGE) {
  if (interaction.user.id === ownerId) return false;

  try {
    const payload = {
      content: message,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {}

  return true;
}
