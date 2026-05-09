import { SlashCommandBuilder } from 'discord.js';
import { Command } from '#structures/classes/Command';
import { GuildService } from '../../database/services/GuildService.js';
import { UserService } from '../../database/services/UserService.js';
import {
  buildLevelPanel,
  getSystemFooter,
  getSystemThumbnail,
  panelReply,
  PANEL_ACCENTS,
} from './_panel.js';

const COMMAND_NAME = 'claimreward';

async function resolveMember(ctx) {
  if (!ctx.guild) return null;

  return (
    ctx.guild.members.cache.get(ctx.userId)
    ?? await ctx.guild.members.fetch(ctx.userId).catch(() => null)
  );
}

async function resolveRole(guild, roleId) {
  return (
    guild.roles.cache.get(roleId)
    ?? await guild.roles.fetch(roleId).catch(() => null)
  );
}

function formatRoleMentions(entries) {
  return entries.map(entry => `<@&${entry.reward.role_id}>`).join(', ');
}

function formatBlockedReward(entry) {
  if (entry.reward.level === 'old') {
    return `- <@&${entry.reward.role_id}>: ${entry.reason}`;
  }

  return `- Level **${entry.reward.level}** <@&${entry.reward.role_id}>: ${entry.reason}`;
}

export const command = new Command({
  name: COMMAND_NAME,
  aliases: ['claim'],
  description: 'Claim your eligible level reward roles',
  category: 'Leveling',
  cooldown: 5,
  slashData: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Claim your eligible level reward roles'),

  async execute(ctx) {
    const member = await resolveMember(ctx);
    if (!member) {
      return ctx.reply(panelReply(buildLevelPanel({
        title: 'Reward Claim',
        subtitle: ctx.guild?.name ?? 'Server Rewards',
        accentColor: PANEL_ACCENTS.error,
        thumbnailUrl: getSystemThumbnail(ctx),
        sections: [
          {
            title: 'Claim Status',
            lines: [
              'Your server profile could not be loaded right now.',
            ],
          },
        ],
        footer: getSystemFooter(ctx),
      })));
    }

    const rewardStatus = UserService.getRewardStatus(
      ctx.userId,
      ctx.guildId,
      member.roles.cache.map(role => role.id),
    );

    if (!rewardStatus.claimableRewards.length) {
      return ctx.reply(panelReply(buildLevelPanel({
        title: 'Reward Claim',
        subtitle: ctx.guild?.name ?? 'Server Rewards',
        accentColor: PANEL_ACCENTS.info,
        thumbnailUrl: getSystemThumbnail(ctx),
        sections: [
          {
            title: 'Claim Status',
            lines: [
              'You do not have any unclaimed reward roles right now.',
              `Current Level: **${rewardStatus.profile?.computedLevel ?? 0}**`,
            ],
          },
        ],
        footer: getSystemFooter(ctx),
      })));
    }

    const resolvedRewards = [];
    const blockedRewards = [];

    for (const reward of rewardStatus.claimableRewards) {
      const role = await resolveRole(ctx.guild, reward.role_id);

      if (!role) {
        blockedRewards.push({
          reward,
          reason: 'Configured role no longer exists.',
        });
        continue;
      }

      if (!role.editable) {
        blockedRewards.push({
          reward,
          reason: 'Move the bot role above this reward role.',
        });
        continue;
      }

      resolvedRewards.push({ reward, role });
    }

    const claimedRewards = [];
    const removedRewards = [];

    for (const entry of resolvedRewards) {
      try {
        await member.roles.add(entry.role.id);
        UserService.markRewardsClaimed(ctx.userId, ctx.guildId, [entry.reward]);
        claimedRewards.push(entry);
      } catch {
        blockedRewards.push({
          reward: entry.reward,
          reason: 'Discord rejected the role update.',
        });
      }
    }

    if (!rewardStatus.stackRewards && claimedRewards.length) {
      const activeTierRoleIds = new Set(
        rewardStatus.activeTierRewards.map(reward => reward.role_id)
      );
      const rewardRoleIds = new Set(
        GuildService.listRewards(ctx.guildId).map(reward => reward.role_id)
      );
      const removableRoles = member.roles.cache.filter(role => (
        rewardRoleIds.has(role.id) && !activeTierRoleIds.has(role.id)
      ));
      const unmanageableRemovals = removableRoles.filter(role => !role.editable);

      if (unmanageableRemovals.size) {
        for (const role of unmanageableRemovals.values()) {
          blockedRewards.push({
            reward: { level: 'old', role_id: role.id },
            reason: 'A lower reward role could not be removed automatically.',
          });
        }
      } else if (removableRoles.size) {
        try {
          await member.roles.remove(removableRoles.map(role => role.id));
          removedRewards.push(...removableRoles.values());
        } catch {
          for (const role of removableRoles.values()) {
            blockedRewards.push({
              reward: { level: 'old', role_id: role.id },
              reason: 'A lower reward role could not be removed automatically.',
            });
          }
        }
      }
    }

    if (!claimedRewards.length) {
      return ctx.reply(panelReply(buildLevelPanel({
        title: 'Reward Claim',
        subtitle: ctx.guild?.name ?? 'Server Rewards',
        accentColor: PANEL_ACCENTS.warning,
        thumbnailUrl: getSystemThumbnail(ctx),
        sections: [
          {
            title: 'Claim Status',
            lines: [
              'No reward roles could be claimed right now.',
            ],
          },
          {
            title: 'Needs Admin Attention',
            lines: blockedRewards.map(formatBlockedReward),
          },
        ],
        footer: getSystemFooter(ctx),
      })));
    }

    const sections = [
      {
        title: 'Claimed Rewards',
        lines: [
          `Roles Added: ${formatRoleMentions(claimedRewards)}`,
          `Reward Mode: **${rewardStatus.stackRewards ? 'Stacked' : 'Highest Tier Only'}**`,
          ...(removedRewards.length
            ? [`Previous Reward Roles Removed: ${removedRewards.map(role => `<@&${role.id}>`).join(', ')}`]
            : []),
        ],
      },
    ];

    if (blockedRewards.length) {
      sections.push({
        title: 'Needs Admin Attention',
        lines: blockedRewards.map(formatBlockedReward),
      });
    }

    return ctx.reply(panelReply(buildLevelPanel({
      title: 'Reward Claim',
      subtitle: ctx.guild?.name ?? 'Server Rewards',
      accentColor: blockedRewards.length ? PANEL_ACCENTS.warning : PANEL_ACCENTS.success,
      thumbnailUrl: getSystemThumbnail(ctx),
      sections,
      footer: getSystemFooter(ctx),
    })));
  },
});
