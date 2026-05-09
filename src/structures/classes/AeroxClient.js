import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { config } from '#config';
import { logger } from '#utils/logger';
import { db, verifyLicense } from '#db';
import { UserRepository } from '../../database/repositories/UserRepository.js';
import { StreakRepository } from '../../database/repositories/StreakRepository.js';
import { LogRepository } from '../../database/repositories/LogRepository.js';
import { GuildSettingsRepository } from '../../database/repositories/GuildSettingsRepository.js';
import { LevelRewardsRepository } from '../../database/repositories/LevelRewardsRepository.js';
import { LevelRewardClaimsRepository } from '../../database/repositories/LevelRewardClaimsRepository.js';
import { XPSettingsRepository } from '../../database/repositories/XPSettingsRepository.js';
import { VoiceTrackingService } from '../../database/services/VoiceTrackingService.js';
import { loadCommands } from '../handlers/commandHandler.js';
import { loadEvents } from '../handlers/eventLoader.js';
import { syncEmojis } from '../../utils/emojiSync.js';

const log = logger.tag('AeroxClient');

export class AeroxClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    });

    this.commands = new Collection();
    this.aliases = new Collection();
    this.cooldowns = new Collection();
    this.voiceSessions = new Map();
    this.prefixCache = new Map();
  }

  getPrefix(guildId) {
    if (!guildId) return config.prefix;
    if (this.prefixCache.has(guildId)) return this.prefixCache.get(guildId);
    const s = GuildSettingsRepository.get(guildId);
    const p = s?.prefix ?? config.prefix;
    this.prefixCache.set(guildId, p);
    return p;
  }

  invalidatePrefixCache(guildId) {
    this.prefixCache.delete(guildId);
  }

  static async start() {
    
    const line = '\x1b[35m────────────────────────────────────────────────────────────\x1b[0m';
    console.log(`\n${line}`);
    console.log(`\x1b[1m\x1b[97m   A E R O X   C L I E N T   S T A R T U P\x1b[0m`);
    console.log(`${line}\n`);

    
    verifyLicense();

    const client = new AeroxClient();

    
    await syncEmojis(process.env.DISCORD_TOKEN).catch((err) => {
      console.error('[EmojiSync] Startup sync failed:', err);
    });

    db.init();
    UserRepository.init();
    StreakRepository.init();
    LogRepository.init();
    GuildSettingsRepository.init();
    LevelRewardsRepository.init();
    LevelRewardClaimsRepository.init();
    XPSettingsRepository.init();

    await loadCommands(client);
    await loadEvents(client);
    VoiceTrackingService.registerShutdownHooks(client);

    await client.login(config.token);
    
    console.log(`${line}`);
    console.log(`\x1b[1m\x1b[97m   A E R O X   L E V E L I N G   S Y S T E M\x1b[0m`);
    console.log(`\x1b[90m   Version: 1.0.0 | Developer: JoshNvrDie\x1b[0m`);
    console.log(`${line}\n`);

    log.success(`Logged in as \x1b[1m${client.user.tag}\x1b[0m`);
    return client;
  }
}
