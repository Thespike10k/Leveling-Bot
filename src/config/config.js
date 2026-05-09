import 'dotenv/config';

function required(key) {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    console.error(`\x1b[31m[CONFIG ERROR]\x1b[0m Missing required env var: ${key}`);
    console.error(`\x1b[33m  → Copy .env.example to .env and fill in your values\x1b[0m`);
    process.exit(1);
  }
  return val.trim();
}

function optional(key, fallback) {
  const val = process.env[key];
  return (val && val.trim() !== '') ? val.trim() : fallback;
}

export const config = {
  token:    required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  prefix:   optional('PREFIX', '!'),
  ownerId:  optional('OWNER_ID', ''),

  xp: {
    minPerMessage:         15,
    maxPerMessage:         40,
    cooldownMs:            60_000,
    voiceXpPerMinute:      10,
    streakBonusMultiplier: 0.10,
  },

  levelFormula: (level) => 5 * level * level + 50 * level + 100,

  colors: {
    primary: 0x7c3aed,
    success: 0x22c55e,
    warning: 0xf59e0b,
    error:   0xef4444,
    info:    0x3b82f6,
  },

  db: {
    path: optional('DB_PATH', './aerox.db'),
  },
};
