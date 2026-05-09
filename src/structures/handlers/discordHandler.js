import { REST, Routes } from 'discord.js';
import { config } from '#config';
import { logger } from '#utils/logger';

const log = logger.tag('SlashCommands');

export async function registerSlashCommands(client) {
  const slashData = [];

  for (const cmd of client.commands.values()) {
    if (cmd.slashData) {
      slashData.push(cmd.slashData.toJSON());
    }
  }

  if (slashData.length === 0) {
    log.warn('No slash commands to register');
    return;
  }

  try {
    const rest = new REST().setToken(config.token);

    log.info(`Registering ${slashData.length} slash commands globally…`);
    await rest.put(Routes.applicationCommands(config.clientId), { body: slashData });
    log.info(`Successfully registered ${slashData.length} slash commands`);
  } catch (err) {
    log.error(`Failed to register slash commands: ${err.message}`);
  }
}
