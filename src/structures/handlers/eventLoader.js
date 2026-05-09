import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from '#utils/logger';

const log = logger.tag('EventLoader');
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const EVENTS_DIR = resolve(__dirname, '../../events');

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

export async function loadEvents(client) {
  const files = walkDir(EVENTS_DIR);
  let loaded = 0;

  for (const filePath of files) {
    try {
      const mod = await import(pathToFileURL(filePath).href);
      const ev = mod.event;
      if (!ev?.name || typeof ev.execute !== 'function') continue;

      const handler = (...args) => ev.execute(client, ...args);

      if (ev.once) {
        client.once(ev.name, handler);
      } else {
        client.on(ev.name, handler);
      }

      loaded++;
    } catch (err) {
      log.error(`Failed to load event ${filePath}: ${err.message}`);
    }
  }

  log.info(`Loaded ${loaded} events`);
}
