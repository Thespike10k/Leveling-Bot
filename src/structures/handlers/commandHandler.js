import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from '#utils/logger';

const log = logger.tag('CommandHandler');
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const COMMANDS_DIR = resolve(__dirname, '../../commands');

function walkDir(dir) {
  const entries = [];
  for (const file of readdirSync(dir)) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      entries.push(...walkDir(fullPath));
    } else if (file.endsWith('.js')) {
      entries.push(fullPath);
    }
  }
  return entries;
}

export async function loadCommands(client) {
  const files = walkDir(COMMANDS_DIR);
  let loaded = 0;

  for (const filePath of files) {
    try {
      const mod = await import(pathToFileURL(filePath).href);
      const cmd = mod.command;
      if (!cmd?.name || typeof cmd.execute !== 'function') continue;

      client.commands.set(cmd.name, cmd);

      for (const alias of cmd.aliases ?? []) {
        client.aliases.set(alias, cmd.name);
      }

      loaded++;
    } catch (err) {
      log.error(`Failed to load ${filePath}: ${err.message}`);
    }
  }

  log.info(`Loaded ${loaded} commands`);
}
