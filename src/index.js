import { AeroxClient } from './structures/classes/AeroxClient.js';

AeroxClient.start().catch((err) => {
  console.error('[FATAL] Failed to start AeroX bot:', err);
  process.exit(1);
});
