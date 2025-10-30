import { VOICE_RANKS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

class RankService {
  constructor() {
    this.ranks = this.sortRanksByHours();
  }

  sortRanksByHours() {
    return [...VOICE_RANKS].sort((a, b) => a.requiredHours - b.requiredHours);
  }

  getCurrentRank(totalHours) {
    const sortedDesc = [...this.ranks].reverse();

    for (const rank of sortedDesc) {
      if (totalHours >= rank.requiredHours) {
        return rank;
      }
    }

    return null;
  }

  getNextRank(totalHours) {
    for (const rank of this.ranks) {
      if (totalHours < rank.requiredHours) {
        const progress = (totalHours / rank.requiredHours) * 100;
        const hoursNeeded = rank.requiredHours - totalHours;

        return {
          rank,
          progress,
          hoursNeeded,
        };
      }
    }

    return null;
  }

  async assignRoles(guild, userId, totalHours) {
    try {
      const member = await guild.members.fetch(userId);
      const earnedRank = this.getCurrentRank(totalHours);

      if (!earnedRank || !earnedRank.roleId) {
        return { changed: false };
      }

      const hasRole = member.roles.cache.has(earnedRank.roleId);
      if (hasRole) {
        return { changed: false };
      }

      const allRankRoleIds = this.ranks.map((r) => r.roleId).filter(Boolean);
      const currentRankRoles = member.roles.cache.filter((role) =>
        allRankRoleIds.includes(role.id)
      );

      const removedRoles = [];

      for (const role of currentRankRoles.values()) {
        await member.roles.remove(role);
        removedRoles.push(role.name);
      }

      await member.roles.add(earnedRank.roleId);

      logger.success(
        `${member.user.username} earned role: ${earnedRank.name} (${Math.floor(totalHours)}h)`
      );

      return {
        changed: true,
        addedRole: earnedRank,
        removedRoles,
        totalHours: Math.floor(totalHours),
      };
    } catch (error) {
      logger.error(`Role assignment error: ${error.message}`);
      return { changed: false, error: error.message };
    }
  }

  getAllRanks() {
    return this.ranks;
  }

  getRankById(rankId) {
    return this.ranks.find((rank) => rank.id === rankId);
  }

  formatProgress(percentage) {
    const barLength = 10;
    const filled = Math.floor((percentage / 100) * barLength);
    const empty = barLength - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}

export const rankService = new RankService();
