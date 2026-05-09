import { GuildSettingsRepository } from '../repositories/GuildSettingsRepository.js';
import { LevelRewardsRepository } from '../repositories/LevelRewardsRepository.js';
import { XPSettingsRepository } from '../repositories/XPSettingsRepository.js';

export const GuildService = {
  getSettings(guildId) {
    return GuildSettingsRepository.get(guildId);
  },

  setPrefix(guildId, prefix) {
    GuildSettingsRepository.patch(guildId, 'prefix', prefix);
  },

  getPrefix(guildId) {
    const s = GuildSettingsRepository.get(guildId);
    return s?.prefix ?? '!';
  },

  setLevelUpChannel(guildId, channelId) {
    GuildSettingsRepository.patch(guildId, 'level_up_channel', channelId);
  },

  setLevelUpDM(guildId, enabled) {
    GuildSettingsRepository.patch(guildId, 'level_up_dm', enabled ? 1 : 0);
  },

  setLevelUpEnabled(guildId, enabled) {
    GuildSettingsRepository.patch(guildId, 'level_up_enabled', enabled ? 1 : 0);
  },

  setLevelUpMessage(guildId, msg) {
    GuildSettingsRepository.patch(guildId, 'level_up_message', msg);
  },

  setLevelUpBackground(guildId, url) {
    GuildSettingsRepository.patch(guildId, 'level_up_background', url);
  },

  setXPRange(guildId, min, max) {
    GuildSettingsRepository.patch(guildId, 'xp_min', min);
    GuildSettingsRepository.patch(guildId, 'xp_max', max);
  },

  setXPCooldown(guildId, secs) {
    GuildSettingsRepository.patch(guildId, 'xp_cooldown_secs', secs);
  },

  setVoiceXP(guildId, enabled) {
    GuildSettingsRepository.patch(guildId, 'voice_xp_enabled', enabled ? 1 : 0);
  },

  setVoiceXPRate(guildId, rate) {
    GuildSettingsRepository.patch(guildId, 'voice_xp_per_min', rate);
  },

  setStackRewards(guildId, enabled) {
    GuildSettingsRepository.patch(guildId, 'stack_rewards', enabled ? 1 : 0);
  },

  formatLevelMessage(template, { mention, username, level, xp }) {
    return template
      .replace(/{mention}/g, mention)
      .replace(/{username}/g, username)
      .replace(/{level}/g, level)
      .replace(/{xp}/g, xp)
      .replace(/{newlevel}/g, level);
  },

  addReward(guildId, level, roleId) {
    LevelRewardsRepository.add(guildId, level, roleId);
  },

  removeReward(guildId, level, roleId) {
    LevelRewardsRepository.remove(guildId, level, roleId);
  },

  listRewards(guildId) {
    return LevelRewardsRepository.list(guildId);
  },

  rewardsForLevel(guildId, level) {
    return LevelRewardsRepository.forLevel(guildId, level);
  },

  setMultiplier(guildId, targetId, type, multiplier) {
    if (multiplier <= 0) {
      XPSettingsRepository.removeMultiplier(guildId, targetId, type);
    } else {
      XPSettingsRepository.setMultiplier(guildId, targetId, type, multiplier);
    }
  },

  getMultipliers(guildId) {
    return XPSettingsRepository.getMultipliers(guildId);
  },

  getEffectiveMultiplier(guildId, channelId, roleIds = []) {
    const all = XPSettingsRepository.getMultipliers(guildId);
    let best = 1.0;
    for (const m of all) {
      if (m.type === 'channel' && m.target_id === channelId) {
        best = Math.max(best, m.multiplier);
      }
      if (m.type === 'role' && roleIds.includes(m.target_id)) {
        best = Math.max(best, m.multiplier);
      }
    }
    return best;
  },

  addBlacklist(guildId, targetId, type) {
    XPSettingsRepository.addBlacklist(guildId, targetId, type);
  },

  removeBlacklist(guildId, targetId, type) {
    XPSettingsRepository.removeBlacklist(guildId, targetId, type);
  },

  getBlacklist(guildId) {
    return XPSettingsRepository.getBlacklist(guildId);
  },

  isBlacklisted(guildId, channelId, userId, roleIds = []) {
    if (XPSettingsRepository.isBlacklisted(guildId, channelId, 'channel')) return true;
    if (XPSettingsRepository.isBlacklisted(guildId, userId, 'user')) return true;
    for (const rid of roleIds) {
      if (XPSettingsRepository.isBlacklisted(guildId, rid, 'role')) return true;
    }
    return false;
  },
};
