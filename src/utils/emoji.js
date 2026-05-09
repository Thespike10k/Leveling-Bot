import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emojisPath = path.join(__dirname, 'emojis.json');

/**
 * Loads emojis from emojis.json dynamically.
 * This is called both at startup and when the file is required.
 */
function loadDynamicEmojis() {
  try {
    if (fs.existsSync(emojisPath)) {
      return JSON.parse(fs.readFileSync(emojisPath, 'utf8'));
    }
  } catch (err) {
    console.error('[EmojiUtil] Failed to load emojis.json:', err);
  }
  return {};
}

const raw = loadDynamicEmojis();

export const emoji = {
  aerox: {
    // Spread all emojis from JSON
    ...raw,
    
    // Custom helper functions
    number: (n) => ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][n] ?? `**${n}**`,
    medal: (pos) => {
      const medals = {
        1: raw.medal1 || '🥇',
        2: raw.medal2 || '🥈',
        3: raw.medal3 || '🥉'
      };
      return medals[pos] ?? `**#${pos}**`;
    }
  },
};
