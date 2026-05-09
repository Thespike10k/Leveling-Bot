import { UserRepository } from '../repositories/UserRepository.js';
import { StreakRepository } from '../repositories/StreakRepository.js';
import { LogRepository } from '../repositories/LogRepository.js';
import { GuildSettingsRepository } from '../repositories/GuildSettingsRepository.js';
import { LevelRewardsRepository } from '../repositories/LevelRewardsRepository.js';
import { LevelRewardClaimsRepository } from '../repositories/LevelRewardClaimsRepository.js';
import { XPSettingsRepository } from '../repositories/XPSettingsRepository.js';
import { config } from '#config';
import { levelFromXp } from '#utils';

const { levelFormula } = config;

function todayStr() { return new Date().toISOString().slice(0, 10); }

function rewardClaimKey(level, roleId) {
  return `${level}:${roleId}`;
}

function rewardKey(reward) {
  return rewardClaimKey(reward.level, reward.role_id);
}

function getClaimedRewardKeys(userId, guildId) {
  return new Set(
    LevelRewardClaimsRepository
      .list(userId, guildId)
      .map(reward => rewardClaimKey(reward.level, reward.role_id))
  );
}

function syncHeldRewardClaims(userId, guildId, eligibleRewards, heldRoleIds, claimedKeys) {
  if (!eligibleRewards.length || !heldRoleIds.length) return;

  const heldRoleSet = new Set(heldRoleIds);

  for (const reward of eligibleRewards) {
    const key = rewardKey(reward);
    if (!heldRoleSet.has(reward.role_id) || claimedKeys.has(key)) continue;

    LevelRewardClaimsRepository.add(userId, guildId, reward.level, reward.role_id);
    claimedKeys.add(key);
  }
}

function getGuildXPConfig(guildId) {
  const s = GuildSettingsRepository.get(guildId);
  return {
    min: s?.xp_min ?? 15,
    max: s?.xp_max ?? 40,
    cooldownSecs: s?.xp_cooldown_secs ?? 0,
    voiceXpPerMin: s?.voice_xp_per_min ?? 10,
    voiceEnabled: (s?.voice_xp_enabled ?? 1) === 1,
  };
}

export const UserService = {
  ensure(userId, guildId) {
    UserRepository.ensure(userId, guildId);
    StreakRepository.ensure(userId, guildId);
    GuildSettingsRepository.ensure(guildId);
  },

  getProfile(userId, guildId) {
    const user = UserRepository.get(userId, guildId);
    if (!user) return null;
    const streak = StreakRepository.get(userId, guildId);
    const rank = UserRepository.rank(userId, guildId);
    const { level, remainingXp } = levelFromXp(user.xp, levelFormula);
    const xpForNext = levelFormula(level);

    const nowTs = Math.floor(Date.now() / 1000);
    const liveVoiceSecs = LogRepository.userActualVoiceTotal(userId, guildId, nowTs)?.total_voice_secs ?? 0;

    return {
      ...user,
      voice_secs: Math.max(user.voice_secs ?? 0, liveVoiceSecs),
      streak,
      rank,
      remainingXp,
      xpForNext,
      computedLevel: level,
    };
  },

  getRewardStatus(userId, guildId, heldRoleIds = []) {
    this.ensure(userId, guildId);

    const settings = GuildSettingsRepository.get(guildId) ?? {};
    const stackRewards = settings.stack_rewards !== 0;
    const profile = this.getProfile(userId, guildId);

    if (!profile) {
      return {
        profile: null,
        stackRewards,
        eligibleRewards: [],
        activeTierRewards: [],
        claimableRewards: [],
      };
    }

    const eligibleRewards = LevelRewardsRepository.forLevel(guildId, profile.computedLevel);
    const claimedKeys = getClaimedRewardKeys(userId, guildId);

    syncHeldRewardClaims(userId, guildId, eligibleRewards, heldRoleIds, claimedKeys);

    const highestEligibleLevel = eligibleRewards.at(-1)?.level ?? null;
    const activeTierRewards = highestEligibleLevel === null
      ? []
      : eligibleRewards.filter(reward => reward.level === highestEligibleLevel);

    const heldRoleSet = new Set(heldRoleIds);
    const pendingRewards = eligibleRewards.filter(reward => (
      !claimedKeys.has(rewardKey(reward)) && !heldRoleSet.has(reward.role_id)
    ));

    const claimableRewards = stackRewards
      ? pendingRewards
      : activeTierRewards.filter(reward => (
        !claimedKeys.has(rewardKey(reward)) && !heldRoleSet.has(reward.role_id)
      ));

    return {
      profile,
      stackRewards,
      eligibleRewards,
      activeTierRewards,
      claimableRewards,
    };
  },

  markRewardsClaimed(userId, guildId, rewards = []) {
    for (const reward of rewards) {
      LevelRewardClaimsRepository.add(userId, guildId, reward.level, reward.role_id);
    }
  },

  /**
   * Process a message from a user.
   * Increments message count immediately and attempts to award XP if eligible.
   * Ensures the message is ONLY logged to the DB once.
   */
  processUserMessage(userId, guildId, channelId, roleIds = []) {
    this.ensure(userId, guildId);
    const now = Math.floor(Date.now() / 1000);

    // 1. Always increment message count instantly
    UserRepository.incrementMessages(userId, guildId);

    // 2. Determine XP eligibility
    let gained = 0;
    const bl = XPSettingsRepository;
    const isEligible = !bl.isBlacklisted(guildId, channelId, 'channel') &&
                       !bl.isBlacklisted(guildId, userId, 'user') &&
                       !roleIds.some(rid => bl.isBlacklisted(guildId, rid, 'role'));

    const user = UserRepository.get(userId, guildId);
    const xpCfg = getGuildXPConfig(guildId);
    const isOnCooldown = (now - (user.last_xp_at ?? 0)) < xpCfg.cooldownSecs;

    if (isEligible && !isOnCooldown) {
      const multipliers = XPSettingsRepository.getMultipliers(guildId);
      let mult = 1.0;
      for (const m of multipliers) {
        if (m.type === 'channel' && m.target_id === channelId) mult = Math.max(mult, m.multiplier);
        if (m.type === 'role' && roleIds.includes(m.target_id)) mult = Math.max(mult, m.multiplier);
      }

      const streak = StreakRepository.get(userId, guildId);
      let streakBonus = 1;
      if (streak.last_claim_at) {
        const diff = now - streak.last_claim_at;
        if (diff <= 36 * 3600) {
          streakBonus = 1 + streak.current * config.xp.streakBonusMultiplier;
        }
      }

      const base = xpCfg.min + Math.floor(Math.random() * (xpCfg.max - xpCfg.min + 1));
      gained = Math.round(base * streakBonus * mult);
      
      // Award XP
      UserRepository.addXP(userId, guildId, gained, now);
    }

    // 3. Log the message (Exactly once, with gained XP)
    LogRepository.logMessage(userId, guildId, channelId, gained);

    if (gained <= 0) return { gained: 0, leveledUp: false };

    // 4. Handle Level Up
    const fresh = UserRepository.get(userId, guildId);
    const prevLevel = user.level;
    const { level: newLevel } = levelFromXp(fresh.xp, levelFormula);

    let leveledUp = false;
    let rewards = [];
    if (newLevel > prevLevel) {
      UserRepository.setLevel(userId, guildId, newLevel);
      leveledUp = true;
      rewards = LevelRewardsRepository.forLevel(guildId, newLevel);
    }

    return { 
      gained, 
      leveledUp, 
      newLevel, 
      prevLevel, 
      totalXp: fresh.xp, 
      rewards,
      mult: gained / (xpCfg.min + (xpCfg.max-xpCfg.min)/2) // Approximate for display
    };
  },

  giveXP(userId, guildId, amount) {
    this.ensure(userId, guildId);
    const user = UserRepository.get(userId, guildId);
    const newXp = Math.max(0, user.xp + amount);
    const { level } = levelFromXp(newXp, levelFormula);
    UserRepository.setXP(userId, guildId, newXp, level);
    return { newXp, level, oldLevel: user.level };
  },

  resetXP(userId, guildId) {
    this.ensure(userId, guildId);
    UserRepository.setXP(userId, guildId, 0, 0);
    StreakRepository.reset(userId, guildId, null);
    StreakRepository.update(userId, guildId, 0, null);
  },

  setLevel(userId, guildId, level) {
    this.ensure(userId, guildId);
    const user = UserRepository.get(userId, guildId);
    let xpNeeded = 0;
    for (let l = 0; l < level; l++) xpNeeded += levelFormula(l);
    UserRepository.setXP(userId, guildId, xpNeeded, level);
    return { xpSet: xpNeeded, oldLevel: user.level };
  },

  claimStreak(userId, guildId) {
    this.ensure(userId, guildId);
    const streak = StreakRepository.get(userId, guildId);
    const now = Math.floor(Date.now() / 1000);
    const today = todayStr();

    if (streak.last_claim_at) {
      const diff = now - streak.last_claim_at;

      if (diff < 12 * 3600) {
        return { success: false, reason: 'cooldown', nextAt: streak.last_claim_at + 12 * 3600 };
      }

      if (diff > 36 * 3600) {
        // Reset streak to 1 if more than 36 hours passed
        StreakRepository.reset(userId, guildId, 1, today, now);
        this.addVoiceXP(userId, guildId, 0); // No XP for reset claim or just addXP
        UserRepository.addXP(userId, guildId, 200, now);
        return { success: true, current: 1, best: Math.max(streak.best, 1), xpGained: 200 };
      }

      const next = streak.current + 1;
      StreakRepository.update(userId, guildId, next, today, now);
      UserRepository.addXP(userId, guildId, 200, now);
      return { success: true, current: next, best: Math.max(streak.best, next), xpGained: 200 };
    } else {
      // First time claim
      StreakRepository.update(userId, guildId, 1, today, now);
      UserRepository.addXP(userId, guildId, 200, now);
      return { success: true, current: 1, best: 1, xpGained: 200 };
    }
  },

  leaderboard(guildId, limit = 10) {
    return UserRepository.leaderboard(guildId, limit);
  },

  messageLeaderboard(guildId, limit = 10) {
    return UserRepository.topChatters(guildId, limit);
  },

  getActualVoiceSeconds(userId, guildId, nowTs = Math.floor(Date.now() / 1000)) {
    return LogRepository.userActualVoiceTotal(userId, guildId, nowTs)?.total_voice_secs ?? 0;
  },

  voiceLeaderboard(guildId, limit = 10, nowTs = Math.floor(Date.now() / 1000)) {
    return LogRepository.guildActualTopSpeakers(guildId, nowTs, limit);
  },

  addVoiceXP(userId, guildId, durationSecs) {
    const safeDurationSecs = Math.max(0, Math.floor(durationSecs ?? 0));
    if (safeDurationSecs <= 0) return 0;

    const settings = GuildSettingsRepository.get(guildId);
    this.ensure(userId, guildId);

    const earnedMinutes = Math.floor(safeDurationSecs / 60);
    const rate = settings?.voice_xp_enabled === 0 ? 0 : (settings?.voice_xp_per_min ?? 10);
    const gained = earnedMinutes * rate;

    UserRepository.addVoice(userId, guildId, safeDurationSecs, gained);

    if (gained <= 0) return 0;

    const user = UserRepository.get(userId, guildId);
    const { level } = levelFromXp(user.xp, levelFormula);
    if (level > user.level) UserRepository.setLevel(userId, guildId, level);
    return gained;
  },
};
